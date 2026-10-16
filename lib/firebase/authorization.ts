import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "./admin";

export type AdminRole = "owner" | "admin" | "editor" | "admissions" | "media";
export type AdminIdentity = { uid: string; email?: string; role: AdminRole; claims: DecodedIdToken };

const collectionRoles: Record<string, AdminRole[]> = {
  pages: ["owner", "admin", "editor"],
  programs: ["owner", "admin", "editor"],
  courses: ["owner", "admin", "editor"],
  news: ["owner", "admin", "editor"],
  calendar: ["owner", "admin", "editor"],
  gallery: ["owner", "admin", "editor", "media"],
  media: ["owner", "admin", "editor", "media"],
  faqs: ["owner", "admin", "editor"],
  policies: ["owner", "admin", "editor"],
  support: ["owner", "admin", "editor"],
  partners: ["owner", "admin", "editor"],
  admissions: ["owner", "admin", "editor"],
  resources: ["owner", "admin", "editor"],
  forms: ["owner", "admin", "editor"],
  brand: ["owner", "admin", "editor"],
  settings: ["owner", "admin"],
  applications: ["owner", "admin", "admissions"],
  employer_inquiries: ["owner", "admin", "admissions"],
  contact_inquiries: ["owner", "admin", "admissions"],
  audit_logs: ["owner", "admin"],
};

export function canManageCollection(role: AdminRole, collection: string) {
  return collectionRoles[collection]?.includes(role) ?? false;
}

export async function requireAdmin(request: NextRequest, allowedRoles?: AdminRole[]) {
  if (!isFirebaseAdminConfigured()) throw new AdminAuthError("Firebase Admin is not configured", 503);
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new AdminAuthError("Authentication required", 401);

  let claims: DecodedIdToken;
  try {
    const auth = await getAdminAuth();
    claims = await auth.verifyIdToken(token, true);
  } catch {
    throw new AdminAuthError("Invalid or expired session", 401);
  }

  let role: AdminRole | undefined;
  if (claims.uid === process.env.FIREBASE_OWNER_UID) {
    role = "owner";
  } else if (claims.admin === true && typeof claims.role === "string" && ["admin", "editor", "admissions", "media"].includes(claims.role)) {
    role = claims.role as AdminRole;
  } else {
    const record = await getAdminDb().collection("admins").doc(claims.uid).get();
    const value = record.data();
    if (value?.active === true && ["admin", "editor", "admissions", "media"].includes(value.role)) role = value.role as AdminRole;
  }

  if (!role || (allowedRoles && !allowedRoles.includes(role))) throw new AdminAuthError("You do not have permission to perform this action", 403);
  return { uid: claims.uid, email: claims.email, role, claims } satisfies AdminIdentity;
}

export class AdminAuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function authErrorResponse(error: unknown) {
  const status = error instanceof AdminAuthError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (status >= 500) console.error("Admin API error", error);
  return Response.json({ error: status === 500 ? "Server error" : message }, { status });
}
