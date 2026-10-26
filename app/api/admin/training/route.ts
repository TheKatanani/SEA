import { AggregateField } from "firebase-admin/firestore";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireAdmin, authErrorResponse } from "@/lib/firebase/authorization";
import { getAdminDb } from "@/lib/firebase/admin";
import { cohortSchema, idSchema, publicCohort, type Cohort } from "@/lib/booking/domain";
import { getCohort, saveCohort } from "@/lib/booking/service";
import { assertBookingEnabled, bookingResponse } from "@/lib/booking/security";
import { trainingQuery } from "@/lib/booking/admin-query";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request, ["owner", "admin"]);
    if (request.nextUrl.searchParams.get("setup") === "true") {
      const missing: string[] = [];
      if (process.env.BOOKINGS_ENABLED !== "true") missing.push("BOOKINGS_ENABLED");
      if (!process.env.PRIVACY_POLICY_VERSION?.trim() || process.env.PRIVACY_POLICY_VERSION.trim() === "pending-approval") missing.push("PRIVACY_POLICY_VERSION");
      if (!process.env.BOOKING_ACCESS_SECRET || process.env.BOOKING_ACCESS_SECRET.length < 32) missing.push("BOOKING_ACCESS_SECRET");
      for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY", "MOYASAR_SECRET_KEY"]) if (!process.env[key]) missing.push(key);
      let bookingReady = true;
      try { assertBookingEnabled(); } catch (error) { bookingReady = false; if (!missing.length) missing.push(error instanceof Error ? error.message : "BOOKING_CONFIGURATION"); }
      return Response.json({ bookingReady, missing, demo: process.env.SITE_DEMO_MODE === "true", applicationsEnabled: process.env.APPLICATIONS_ENABLED === "true", webhookConfigured: Boolean(process.env.MOYASAR_WEBHOOK_SECRET) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (request.nextUrl.searchParams.get("overview") === "true") {
      const db = getAdminDb();
      try {
        const [cohorts, confirmedBookings, pendingCount] = await Promise.all([
          db.collection("cohorts").count().get(),
          db.collection("bookings").where("status", "==", "CONFIRMED").get(),
          db.collection("bookings").where("status", "==", "PENDING").count().get(),
        ]);
        let revenueMinor = 0;
        confirmedBookings.forEach((doc) => {
          revenueMinor += (doc.data().amountMinor as number) || 0;
        });
        return Response.json({
          cohorts: cohorts.data().count,
          confirmed: confirmedBookings.size,
          pending: pendingCount.data().count,
          revenueMinor,
        }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (err) {
        console.error("Overview error", err);
        return Response.json({ cohorts: 0, confirmed: 0, pending: 0, revenueMinor: 0 }, { headers: { "Cache-Control": "private, no-store" } });
      }
    }
    if (request.nextUrl.searchParams.has("cohortId") && !request.nextUrl.searchParams.has("collection")) {
      const id = idSchema.parse(request.nextUrl.searchParams.get("cohortId"));
      const current = await getCohort(id);
      const [draft, metadata] = await Promise.all([getAdminDb().collection("content_drafts").doc("cohorts__" + id).get(), getAdminDb().collection("content_translation_state").doc("cohorts__" + id).get()]);
      const cohort = { ...current, ...(draft.data()?.data || {}), confirmedSeats: current.confirmedSeats, holds: current.holds };
      return Response.json({ cohort: publicCohort(cohort), translationState: metadata.data()?.fields || {} }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const { collection, query: base, rawQuery } = trainingQuery(request);
    let query = base;
    const cursor = request.nextUrl.searchParams.get("cursor");
    if (cursor) {
      const document = await getAdminDb().collection(collection).doc(idSchema.parse(cursor)).get();
      if (!document.exists) return Response.json({ error: "INVALID_CURSOR" }, { status: 400 });
      query = query.startAfter(document);
    }
    let docs: FirebaseFirestore.QueryDocumentSnapshot[];
    let hasMore = false;
    try {
      const rows = await query.limit(31).get();
      docs = rows.docs.slice(0, 30);
      hasMore = rows.size > 30;
    } catch (queryErr: unknown) {
      const err = queryErr as { code?: number; message?: string };
      if (err?.code === 9 || err?.message?.includes("index") || err?.message?.includes("FAILED_PRECONDITION")) {
        console.warn("Index missing on admin training query, using in-memory sort fallback:", err?.message);
        const fallbackRows = await (rawQuery || getAdminDb().collection(collection)).limit(100).get();
        const sortField = collection === "payments" ? "updatedAt" : "createdAt";
        const sorted = [...fallbackRows.docs].sort((a, b) => {
          const aVal = (a.data()[sortField] as number) || 0;
          const bVal = (b.data()[sortField] as number) || 0;
          return bVal - aVal;
        });
        docs = sorted.slice(0, 30);
        hasMore = sorted.length > 30;
      } else {
        throw queryErr;
      }
    }
    const drafts = collection === "cohorts" && docs.length ? await getAdminDb().getAll(...docs.map(doc => getAdminDb().collection("content_drafts").doc("cohorts__" + doc.id))) : [];
    const bookingIds = collection === "payments" ? [...new Set(docs.map(doc => String(doc.data().bookingId || "")).filter(id => idSchema.safeParse(id).success))] : [];
    const linkedBookings = bookingIds.length ? await getAdminDb().getAll(...bookingIds.map(id => getAdminDb().collection("bookings").doc(id))) : [];
    const bookingLabels = new Map(linkedBookings.map(doc => [doc.id, { bookingNumber: doc.data()?.bookingNumber || "", learnerName: doc.data()?.attendee?.fullName || "" }]));
    return Response.json({ items: docs.map((doc, index) => {
      const value = { ...doc.data(), id: doc.id } as Cohort;
      if (collection === "cohorts") return { ...publicCohort(value), hasDraft: drafts[index]?.exists || false };
      const { searchTokens: _tokens, ...item } = value as Record<string, unknown>;
      return collection === "payments" ? { ...item, ...bookingLabels.get(String(item.bookingId)) } : item;
    }), nextCursor: hasMore ? docs[docs.length - 1].id : null }, { headers: { "Cache-Control": "private, no-store" } });
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
    const { translationReview, ...data } = JSON.parse(raw);
    const review = z.object({ reviewed: z.array(z.string().max(170)).max(30), aiPaths: z.array(z.string().max(170)).max(30).optional() }).strict().parse(translationReview || { reviewed: [] });
    const id = await saveCohort(cohortSchema.parse(data), identity.uid, review);
    return Response.json({ ok: true, id });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "INVALID_COHORT", details: error instanceof z.ZodError ? error.issues.map((v) => ({ path: v.path, message: v.message })) : [] }, { status: 400 });
    if (error instanceof Error && error.name === "AdminAuthError") return authErrorResponse(error);
    return bookingResponse(error);
  }
}

