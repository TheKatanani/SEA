import "server-only";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { BookingError } from "./domain";

export function secureEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function bookingSignature(id: string, purpose = "access") {
  const secret = process.env.BOOKING_ACCESS_SECRET;
  if (!secret || secret.length < 32) throw new BookingError("BOOKING_NOT_CONFIGURED", 503);
  return createHmac("sha256", secret).update(purpose + ":" + id).digest("hex");
}
export function assertBookingAccess(id: string, token: string) {
  const [expiry, signature, extra] = token.split(".");
  if (extra || !/^\d{13}$/.test(expiry || "") || Number(expiry) <= Date.now() || !secureEqual(bookingSignature(id + ":" + expiry), signature || "")) throw new BookingError("BOOKING_ACCESS_DENIED", 403);
}
export function bookingAccessToken(id: string, expiry = Date.now() + 30 * 24 * 3600000) {
  return String(expiry) + "." + bookingSignature(id + ":" + expiry);
}
export function assertOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin : request.nextUrl.origin;
  if (!origin || origin !== expected) throw new BookingError("INVALID_ORIGIN", 403);
}
export function assertBookingEnabled() {
  if (process.env.BOOKINGS_ENABLED !== "true") throw new BookingError("BOOKING_NOT_ENABLED", 503);
  bookingSignature("configuration-check");
  if (!process.env.PRIVACY_POLICY_VERSION?.trim() || process.env.PRIVACY_POLICY_VERSION.trim() === "pending-approval") throw new BookingError("PRIVACY_POLICY_NOT_CONFIGURED", 503);
  if (!process.env.MOYASAR_SECRET_KEY || !process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || !process.env.NEXT_PUBLIC_APP_URL) throw new BookingError("PAYMENT_NOT_CONFIGURED", 503);
  const live = process.env.MOYASAR_SECRET_KEY.startsWith("sk_live_");
  if (process.env.SITE_DEMO_MODE === "true" && live) throw new BookingError("DEMO_REQUIRES_TEST_KEYS", 503);
  if (!process.env.MOYASAR_SECRET_KEY.startsWith(live ? "sk_live_" : "sk_test_") || !process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY.startsWith(live ? "pk_live_" : "pk_test_")) throw new BookingError("PAYMENT_MODE_MISMATCH", 503);
  if (live && new URL(process.env.NEXT_PUBLIC_APP_URL).protocol !== "https:") throw new BookingError("HTTPS_REQUIRED", 503);
}
export function bookingResponse(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  if (error instanceof BookingError) return Response.json({ error: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  console.error("Training operation failed", error instanceof Error ? error.name : "unknown");
  return Response.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
}

