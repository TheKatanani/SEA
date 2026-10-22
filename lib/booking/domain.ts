import { z } from "zod";

export const HOLD_MS = 15 * 60 * 1000;
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,150}$/);
export const cohortSchema = z.object({
  id: idSchema.optional(),
  programCollection: z.enum(["programs", "courses"]),
  programId: idSchema,
  cohortCode: z.string().trim().min(2).max(60),
  titleAr: z.string().trim().min(3).max(200),
  titleEn: z.string().trim().min(3).max(200),
  priceMinor: z.number().int().min(100).max(10_000_000),
  currency: z.literal("SAR").default("SAR"),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timeZone: z.literal("Asia/Riyadh").default("Asia/Riyadh"),
  scheduleAr: z.string().trim().min(3).max(400),
  scheduleEn: z.string().trim().min(3).max(400),
  locationType: z.enum(["in_person", "remote"]),
  venueAr: z.string().trim().min(3).max(300),
  venueEn: z.string().trim().min(3).max(300),
  capacity: z.number().int().min(1).max(500),
  registrationOpen: z.boolean(),
  status: z.enum(["draft", "published"]),
}).strict().refine((v) => Date.parse(v.endAt) > Date.parse(v.startAt), { message: "End must follow start", path: ["endAt"] });
export type CohortInput = z.infer<typeof cohortSchema>;
export type Cohort = CohortInput & { id: string; confirmedSeats: number; holds: Record<string, number>; createdAt: number; updatedAt: number };
export const attendeeSchema = z.object({
  fullName: z.string().trim().min(6).max(150),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  mobile: z.string().trim().regex(/^\+?[0-9 ()-]{9,20}$/),
  nationalId: z.string().trim().regex(/^[12][0-9]{9}$/),
}).strict();
export type Attendee = z.infer<typeof attendeeSchema>;
export type BookingStatus = "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED" | "REFUND_PENDING" | "REFUNDED";
export type Booking = {
  id: string; bookingNumber: string; cohortId: string; attendee: Attendee;
  status: BookingStatus; amountMinor: number; currency: "SAR"; holdExpiresAt: number;
  createdAt: number; updatedAt: number; locale: "ar" | "en"; privacyPolicyVersion: string;
  searchTokens: string[]; paymentId?: string; confirmedAt?: number;
};
export type VerifiedPayment = {
  id: string; status: string; amount: number; currency: string;
  metadata?: Record<string, string>; source?: { type?: string; company?: string };
  refunded?: number; live?: boolean;
};
export class BookingError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export function activeHolds(cohort: Pick<Cohort, "holds">, now: number): Record<string, number> {
  return Object.fromEntries(Object.entries(cohort.holds || {}).filter(([, end]) => Number.isFinite(end) && end > now));
}
export function availability(cohort: Cohort, now = Date.now()) {
  const held = Object.keys(activeHolds(cohort, now)).length;
  const remaining = Math.max(0, cohort.capacity - (cohort.confirmedSeats || 0) - held);
  return { remaining, held, confirmed: cohort.confirmedSeats || 0, capacity: cohort.capacity,
    open: cohort.status === "published" && cohort.registrationOpen && Date.parse(cohort.startAt) > now && remaining > 0 };
}
export function reserve(cohort: Cohort, bookingId: string, now: number) {
  if (!availability(cohort, now).open) throw new BookingError("REGISTRATION_CLOSED");
  return { ...activeHolds(cohort, now), [bookingId]: now + HOLD_MS };
}
export function validateCapacity(cohort: Cohort, capacity: number, now: number) {
  if (capacity < (cohort.confirmedSeats || 0) + Object.keys(activeHolds(cohort, now)).length) throw new BookingError("CAPACITY_BELOW_COMMITMENTS");
}
export function paymentDecision(booking: Booking, cohort: Cohort, payment: VerifiedPayment, now: number) {
  if (payment.amount !== booking.amountMinor || payment.currency !== booking.currency) throw new BookingError("PAYMENT_AMOUNT_MISMATCH", 422);
  const holds = activeHolds(cohort, now);
  let confirmedSeats = cohort.confirmedSeats || 0;
  let status = booking.status;
  let paymentId = booking.paymentId;
  let refundRequired = false;
  const isPaid = payment.status === "paid" || payment.status === "captured";
  const fullyRefunded = (payment.refunded || 0) >= payment.amount;
  if (fullyRefunded) {
    if (paymentId === payment.id || (!paymentId && status !== "CONFIRMED")) {
      if (status === "CONFIRMED") confirmedSeats = Math.max(0, confirmedSeats - 1);
      delete holds[booking.id]; status = "REFUNDED"; paymentId = payment.id;
    }
  } else if (isPaid) {
    if (paymentId === payment.id && status === "CONFIRMED") return { holds, confirmedSeats, status, paymentId, refundRequired };
    if (paymentId && paymentId !== payment.id) {
      refundRequired = true;
    } else if (status === "PENDING" && holds[booking.id] > now && booking.holdExpiresAt > now && confirmedSeats < cohort.capacity) {
      delete holds[booking.id]; confirmedSeats += 1; status = "CONFIRMED"; paymentId = payment.id;
    } else {
      delete holds[booking.id]; status = "REFUND_PENDING"; paymentId = payment.id; refundRequired = true;
    }
  }
  return { holds, confirmedSeats, status, paymentId, refundRequired };
}
export function searchTokens(values: string[]) {
  const tokens = new Set<string>();
  for (const value of values) {
    for (const text of [value, ...value.split(/\s+/)]) {
      const normalized = text.toLowerCase().trim().slice(0, 100);
      if (normalized) tokens.add(normalized);
      for (let n = 2; n <= Math.min(30, normalized.length); n++) tokens.add(normalized.slice(0, n));
    }
  }
  return [...tokens].slice(0, 350);
}
export function publicCohort(cohort: Cohort, now = Date.now()) {
  const { holds: _holds, ...publicFields } = cohort;
  return { ...publicFields, ...availability(cohort, now) };
}

