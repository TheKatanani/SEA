import type { NextRequest } from "next/server";
import { assertBookingAccess, bookingResponse, bookingSignature } from "@/lib/booking/security";
import { getBooking, getCohort, settlePayment } from "@/lib/booking/service";
import { fetchMoyasarPayment } from "@/lib/payments/moyasar";
import { publicCohort } from "@/lib/booking/domain";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await context.params;
    assertBookingAccess(bookingId, request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
    const booking = await getBooking(bookingId);
    const cohort = await getCohort(booking.cohortId);
    return Response.json({ booking: { id: booking.id, bookingNumber: booking.bookingNumber, status: booking.status, amountMinor: booking.amountMinor, currency: booking.currency, holdExpiresAt: booking.holdExpiresAt, fullName: booking.attendee.fullName, confirmedAt: booking.confirmedAt }, cohort: publicCohort(cohort), checkoutReference: bookingSignature(bookingId, "payment"), paymentEnabled: !!process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return bookingResponse(error); }
}


export async function POST(request: NextRequest, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await context.params;
    assertBookingAccess(bookingId, request.headers.get("authorization")?.replace(/^Bearer /, "") || "");
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1000) return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const body = JSON.parse(raw);
    if (typeof body.paymentId !== "string") return Response.json({ error: "INVALID_PAYMENT_ID" }, { status: 400 });
    const payment = await fetchMoyasarPayment(body.paymentId);
    if (payment.metadata?.booking_id !== bookingId) return Response.json({ error: "PAYMENT_REFERENCE_MISMATCH" }, { status: 422 });
    await settlePayment(payment, "verify_" + payment.id + "_" + payment.status + "_" + (payment.refunded || 0));
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return bookingResponse(error); }
}
