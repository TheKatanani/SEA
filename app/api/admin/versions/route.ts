import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin, canManageCollection, authErrorResponse } from "@/lib/firebase/authorization";
import { getAdminDb } from "@/lib/firebase/admin";
import { idSchema } from "@/lib/booking/domain";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const allowed = new Set(["pages", "programs", "courses", "brand", "policies", "support", "gallery", "faqs", "partners", "news", "calendar", "admissions", "resources", "forms"]);
export async function GET(request: NextRequest) {
  try {
    const identity = await requireAdmin(request);
    const collection = request.nextUrl.searchParams.get("collection") || "";
    const recordId = idSchema.parse(request.nextUrl.searchParams.get("id"));
    if (!allowed.has(collection) || !canManageCollection(identity.role, collection)) return Response.json({ error: "UNAUTHORIZED" }, { status: 403 });
    const rows = await getAdminDb().collection("content_versions").where("collection", "==", collection).where("recordId", "==", recordId).orderBy("at", "desc").limit(20).get();
    return Response.json({ items: rows.docs.map((doc) => ({ id: doc.id, at: doc.data().at?.toDate?.().toISOString() || null })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const identity = await requireAdmin(request);
    const body = z.object({ versionId: idSchema }).strict().parse(await request.json());
    const db = getAdminDb();
    const version = await db.collection("content_versions").doc(body.versionId).get(); const value = version.data();
    if (!value || !allowed.has(value.collection) || !canManageCollection(identity.role, value.collection)) return Response.json({ error: "UNAUTHORIZED" }, { status: 403 });
    const draft = db.collection("content_drafts").doc(value.collection + "__" + value.recordId);
    const batch = db.batch();
    batch.set(draft, { collection: value.collection, recordId: value.recordId, data: { ...value.data, status: "draft", updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() } });
    batch.create(db.collection("audit_logs").doc(), { action: "record.version.restored_to_draft", collection: value.collection, recordId: value.recordId, actorUid: identity.uid, at: FieldValue.serverTimestamp() });
    await batch.commit(); return Response.json({ ok: true });
  } catch (error) { return authErrorResponse(error); }
}

