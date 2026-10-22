import { z } from "zod";
import type { NextRequest } from "next/server";
import { attendeeSchema, idSchema } from "@/lib/booking/domain";
import { createBooking } from "@/lib/booking/service";
import { assertBookingEnabled, assertOrigin, bookingResponse } from "@/lib/booking/security";
export const runtime = "nodejs";
const schema = z.object({ cohortId: idSchema, requestKey: z.string().uuid(), attendee: attendeeSchema, locale: z.enum(["ar", "en"]), privacyConsent: z.literal(true) }).strict();
export async function POST(request: NextRequest) {
  try {
    assertOrigin(request); assertBookingEnabled();
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 8000) return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const input = schema.parse(JSON.parse(raw));
    const result = await createBooking(input.cohortId, input.requestKey, input.attendee, input.locale, request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown");
    return Response.json({ id: result.booking.id, accessToken: result.accessToken, status: result.booking.status }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "INVALID_BOOKING_DETAILS" }, { status: 400 });
    return bookingResponse(error);
  }
}

