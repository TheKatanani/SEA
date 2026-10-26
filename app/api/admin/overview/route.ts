import type { NextRequest } from "next/server";
import { requireAdmin, canManageCollection, authErrorResponse } from "@/lib/firebase/authorization";
import { getAdminDb } from "@/lib/firebase/admin";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request); const db = getAdminDb();
    const definitions = [
      { key: "programs", collection: "programs", status: "published" }, { key: "courses", collection: "courses", status: "published" },
      { key: "applications", collection: "applications", status: "new" }, { key: "employer_inquiries", collection: "employer_inquiries", status: "new" }, { key: "contact_inquiries", collection: "contact_inquiries", status: "new" },
      { key: "pages", collection: "pages", status: "published" }, { key: "media", collection: "media", status: "" },
      ...(["owner", "admin"].includes(user.role) ? [{ key: "cohorts", collection: "cohorts", status: "published" }, { key: "bookings", collection: "bookings", status: "CONFIRMED" }] : []),
    ].filter(d => ["cohorts", "bookings"].includes(d.key) || canManageCollection(user.role, d.collection));
    const metrics = await Promise.all(definitions.map(async d => { try { const ref = db.collection(d.collection); const count = await (d.status ? ref.where("status", "==", d.status) : ref).count().get(); return { key: d.key, count: count.data().count }; } catch { return { key: d.key, count: null }; } }));
    return Response.json({ metrics }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
