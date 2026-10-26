import type { NextRequest } from "next/server";
import { requireAdmin, canManageCollection, authErrorResponse } from "@/lib/firebase/authorization";
import { recordTitle } from "@/lib/admin/records";
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
    const recentGroups = await Promise.all(definitions.filter(d => !["cohorts", "bookings"].includes(d.key)).map(async d => {
      try { const inbox = ["applications", "employer_inquiries", "contact_inquiries"].includes(d.collection); const snapshot = await db.collection(d.collection).orderBy(inbox ? "createdAt" : "updatedAt", "desc").limit(4).get();
        return snapshot.docs.map(doc => { const data = doc.data(); const raw = data.updatedAt || data.createdAt; return { id: doc.id, collection: d.collection, titleAr: recordTitle(data, false), titleEn: recordTitle(data, true), status: String(data.status || ""), at: typeof raw?.toDate === "function" ? raw.toDate().toISOString() : typeof raw === "string" ? raw : "" }; });
      } catch { return []; }
    }));
    const recent = recentGroups.flat().sort((a,b) => b.at.localeCompare(a.at)).slice(0, 12);
    return Response.json({ metrics, recent }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
