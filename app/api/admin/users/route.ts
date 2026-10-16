import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { authErrorResponse, requireAdmin } from "@/lib/firebase/authorization";

export const runtime = "nodejs";
const createSchema = z.object({ email: z.string().trim().email().max(254), role: z.enum(["admin", "editor", "admissions", "media"]) });

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request, ["owner"]);
    const snapshot = await getAdminDb().collection("admins").limit(100).get();
    const auth = await getAdminAuth();
    const users = await Promise.all(snapshot.docs.map(async (doc) => {
      const value = doc.data();
      let email = value.email as string | undefined;
      try { email = (await auth.getUser(doc.id)).email || email; } catch {}
      return { id: doc.id, email: email || "", role: value.role || "editor", active: value.active === true };
    }));
    return Response.json({ users }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireAdmin(request, ["owner"]);
    const body = createSchema.parse(await request.json());
    const email = body.email.toLowerCase();
    const auth = await getAdminAuth();
    let user;
    let created = false;
    try { user = await auth.getUserByEmail(email); }
    catch { user = await auth.createUser({ email, emailVerified: false, disabled: false }); created = true; }
    if (user.uid === process.env.FIREBASE_OWNER_UID) return Response.json({ error: "The owner account cannot be changed here" }, { status: 400 });
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true, role: body.role });
    await getAdminDb().collection("admins").doc(user.uid).set({ email, role: body.role, active: true, updatedAt: FieldValue.serverTimestamp(), updatedBy: owner.uid }, { merge: true });
    await getAdminDb().collection("audit_logs").add({ action: "admin.role.updated", recordId: user.uid, actorUid: owner.uid, role: body.role, at: FieldValue.serverTimestamp() });
    const inviteLink = created ? await auth.generatePasswordResetLink(email) : undefined;
    return Response.json({ ok: true, inviteLink, created });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Enter a valid email and role" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const owner = await requireAdmin(request, ["owner"]);
    const uid = request.nextUrl.searchParams.get("uid") || "";
    if (!uid || uid === owner.uid || uid === process.env.FIREBASE_OWNER_UID) return Response.json({ error: "This account cannot be removed" }, { status: 400 });
    const auth = await getAdminAuth();
    const user = await auth.getUser(uid);
    const claims = { ...user.customClaims };
    delete claims.admin;
    delete claims.role;
    await auth.setCustomUserClaims(uid, claims);
    await getAdminDb().collection("admins").doc(uid).delete();
    await getAdminDb().collection("audit_logs").add({ action: "admin.role.removed", recordId: uid, actorUid: owner.uid, at: FieldValue.serverTimestamp() });
    return Response.json({ ok: true });
  } catch (error) { return authErrorResponse(error); }
}
