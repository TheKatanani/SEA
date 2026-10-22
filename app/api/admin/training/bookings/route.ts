import { z } from "zod";
import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin, authErrorResponse } from "@/lib/firebase/authorization";
import { getAdminDb } from "@/lib/firebase/admin";
import { activeHolds, BookingError, idSchema, type Booking, type Cohort } from "@/lib/booking/domain";
import { bookingResponse } from "@/lib/booking/security";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const identity = await requireAdmin(request, ["owner", "admin"]);
    const input = z.object({ bookingId: idSchema, action: z.literal("cancel") }).strict().parse(await request.json());
    const db = getAdminDb(); const ref = db.collection("bookings").doc(input.bookingId);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new BookingError("BOOKING_NOT_FOUND", 404);
      const booking = snapshot.data() as Booking;
      if (["CANCELLED", "EXPIRED"].includes(booking.status)) return;
      if (booking.status !== "PENDING") throw new BookingError("PAID_BOOKING_REQUIRES_REFUND", 409);
      const cohortRef = db.collection("cohorts").doc(booking.cohortId);
      const cohort = await tx.get(cohortRef); const now = Date.now();
      if (cohort.exists) {
        const holds = activeHolds(cohort.data() as Cohort, now); delete holds[input.bookingId];
        tx.update(cohortRef, { holds, updatedAt: now });
      }
      tx.update(ref, { status: "CANCELLED", updatedAt: now });
      tx.create(db.collection("audit_logs").doc(), { action: "booking.cancelled", collection: "bookings", recordId: input.bookingId, actorUid: identity.uid, at: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
    if (error instanceof Error && error.name === "AdminAuthError") return authErrorResponse(error);
    return bookingResponse(error);
  }
}

