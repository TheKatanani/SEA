import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { authErrorResponse, canManageCollection, requireAdmin } from "@/lib/firebase/authorization";
import { validateCmsRecord } from "@/lib/cms-validation";
import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const managedCollections = new Set([
  "pages", "programs", "courses", "news", "calendar", "gallery", "media", "faqs",
  "policies", "support", "partners", "admissions", "resources", "forms", "brand", "settings", "applications", "employer_inquiries", "contact_inquiries", "audit_logs",
]);
const payloadSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,180}$/).optional(),
  data: z.record(z.string(), z.unknown()),
});
const submissionCollections = new Set(["applications", "employer_inquiries", "contact_inquiries"]);

function serialize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, serialize(field)]));
  return value;
}

function refreshSite(collection: string) {
  if (["pages", "brand", "programs", "courses", "news", "calendar", "gallery", "faqs", "policies", "support", "partners", "admissions", "resources", "forms"].includes(collection)) {
    revalidatePath("/");
    revalidatePath("/[locale]", "layout");
  }
}

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAdmin(request);
    const collection = request.nextUrl.searchParams.get("collection") || "";
    if (!managedCollections.has(collection) || !canManageCollection(identity.role, collection)) {
      return Response.json({ error: "Collection unavailable" }, { status: 403 });
    }
    const reference = getAdminDb().collection(collection);
    const snapshot = ["applications", "employer_inquiries", "contact_inquiries"].includes(collection)
      ? await reference.orderBy("createdAt", "desc").limit(100).get()
      : collection === "audit_logs" ? await reference.orderBy("at", "desc").limit(100).get() : await reference.limit(100).get();
    const drafts = !submissionCollections.has(collection) && collection !== "audit_logs" && snapshot.size ? await getAdminDb().getAll(...snapshot.docs.map((doc) => getAdminDb().collection("content_drafts").doc(collection + "__" + doc.id))) : [];
    return Response.json({ items: snapshot.docs.map((doc, index) => ({ ...serialize(drafts[index]?.exists ? drafts[index].data()?.data : doc.data()) as object, id: doc.id, hasDraft: drafts[index]?.exists || false })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireAdmin(request);
    const collection = request.nextUrl.searchParams.get("collection") || "";
    if (collection === "audit_logs") return Response.json({ error: "Audit history is read-only" }, { status: 405 });
    if (!managedCollections.has(collection) || !canManageCollection(identity.role, collection)) {
      return Response.json({ error: "Collection unavailable" }, { status: 403 });
    }
    const body = payloadSchema.parse(await request.json());
    if (Buffer.byteLength(JSON.stringify(body.data), "utf8") > 500_000) return Response.json({ error: "Content is too large" }, { status: 413 });

    const db = getAdminDb();
    const reference = body.id ? db.collection(collection).doc(body.id) : db.collection(collection).doc();
    const previous = body.id ? await reference.get() : null;
    if (submissionCollections.has(collection) && !previous?.exists) return Response.json({ error: "Requests can only be created through the public form" }, { status: 403 });
    const { id: _recordId, ...recordData } = body.data;
    let values: Record<string, unknown> = submissionCollections.has(collection) ? recordData : validateCmsRecord(collection, recordData);
    if (submissionCollections.has(collection)) {
      const status = z.enum(["new", "in_review", "contacted", "accepted", "closed"]).safeParse(recordData.status);
      const internalNotes = z.string().max(4_000).safeParse(recordData.internalNotes ?? "");
      if (!status.success || !internalNotes.success) return Response.json({ error: "Invalid request status or notes" }, { status: 400 });
      values = { status: status.data, internalNotes: internalNotes.data };
    }
    await db.runTransaction(async (tx) => {
      const current = await tx.get(reference);
      const draftRef = db.collection("content_drafts").doc(collection + "__" + reference.id);
      const metadata = { createdAt: current.data()?.createdAt ?? FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: identity.uid };
      if (!submissionCollections.has(collection) && current.exists) {
        tx.create(db.collection("content_versions").doc(), { collection, recordId: reference.id, data: current.data(), actorUid: identity.uid, at: FieldValue.serverTimestamp() });
      }
      if (!submissionCollections.has(collection) && current.data()?.status === "published" && values.status === "draft") {
        tx.set(draftRef, { data: { ...current.data(), ...values, ...metadata }, collection, recordId: reference.id });
      } else {
        tx.set(reference, { ...values, ...metadata }, { merge: true });
        if (!submissionCollections.has(collection)) tx.delete(draftRef);
      }
      tx.create(db.collection("audit_logs").doc(), { action: current.exists ? "record.updated" : "record.created", collection, recordId: reference.id, actorUid: identity.uid, at: FieldValue.serverTimestamp() });
    });
    refreshSite(collection);
    return Response.json({ id: reference.id, ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid record", details: error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const identity = await requireAdmin(request);
    const collection = request.nextUrl.searchParams.get("collection") || "";
    const id = request.nextUrl.searchParams.get("id") || "";
    if (collection === "audit_logs") return Response.json({ error: "Audit history is read-only" }, { status: 405 });
    if (!managedCollections.has(collection) || !canManageCollection(identity.role, collection) || !id || id.includes("/")) {
      return Response.json({ error: "Record unavailable" }, { status: 403 });
    }
    if (submissionCollections.has(collection) && !["owner", "admin"].includes(identity.role)) return Response.json({ error: "Only an administrator can delete requests" }, { status: 403 });
    await getAdminDb().collection(collection).doc(id).delete();
    await getAdminDb().collection("audit_logs").add({ action: "record.deleted", collection, recordId: id, actorUid: identity.uid, at: FieldValue.serverTimestamp() });
    refreshSite(collection);
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
