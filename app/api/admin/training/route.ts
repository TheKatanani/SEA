import { AggregateField } from "firebase-admin/firestore";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAdmin, authErrorResponse } from "@/lib/firebase/authorization";
import { getAdminDb } from "@/lib/firebase/admin";
import { cohortSchema, idSchema, publicCohort } from "@/lib/booking/domain";
import { getCohort, saveCohort } from "@/lib/booking/service";
import { bookingResponse } from "@/lib/booking/security";
import { trainingQuery } from "@/lib/booking/admin-query";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request, ["owner", "admin"]);
    if (request.nextUrl.searchParams.get("overview") === "true") {
      const db = getAdminDb();
      const [cohorts, confirmed, pending, revenue] = await Promise.all([
        db.collection("cohorts").count().get(), db.collection("bookings").where("status", "==", "CONFIRMED").count().get(),
        db.collection("bookings").where("status", "==", "PENDING").where("holdExpiresAt", ">", Date.now()).count().get(),
        db.collection("payments").where("status", "in", ["paid", "captured", "refunded"]).where("refundRequired", "==", false).aggregate({ amount: AggregateField.sum("amountMinor"), refunded: AggregateField.sum("refundedMinor") }).get(),
      ]);
      return Response.json({ cohorts: cohorts.data().count, confirmed: confirmed.data().count, pending: pending.data().count, revenueMinor: revenue.data().amount - revenue.data().refunded }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (request.nextUrl.searchParams.has("cohortId") && !request.nextUrl.searchParams.has("collection")) return Response.json({ cohort: publicCohort(await getCohort(idSchema.parse(request.nextUrl.searchParams.get("cohortId")))) });
    const { collection, query: base } = trainingQuery(request);
    let query = base;
    const cursor = request.nextUrl.searchParams.get("cursor");
    if (cursor) {
      const document = await getAdminDb().collection(collection).doc(idSchema.parse(cursor)).get();
      if (!document.exists) return Response.json({ error: "INVALID_CURSOR" }, { status: 400 });
      query = query.startAfter(document);
    }
    const rows = await query.limit(31).get();
    const docs = rows.docs.slice(0, 30);
    return Response.json({ items: docs.map((doc) => {
      const value = { ...doc.data(), id: doc.id };
      if (collection === "cohorts") return publicCohort(value as Parameters<typeof publicCohort>[0]);
      const { searchTokens: _tokens, ...item } = value as Record<string, unknown>;
      return item;
    }), nextCursor: rows.size > 30 ? docs[docs.length - 1].id : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "INVALID_QUERY" }, { status: 400 });
    if (error instanceof Error && error.name === "AdminAuthError") return authErrorResponse(error);
    return bookingResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const identity = await requireAdmin(request, ["owner", "admin"]);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 12000) return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const id = await saveCohort(cohortSchema.parse(JSON.parse(raw)), identity.uid);
    return Response.json({ ok: true, id });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "INVALID_COHORT", details: error instanceof z.ZodError ? error.issues.map((v) => ({ path: v.path, message: v.message })) : [] }, { status: 400 });
    if (error instanceof Error && error.name === "AdminAuthError") return authErrorResponse(error);
    return bookingResponse(error);
  }
}

