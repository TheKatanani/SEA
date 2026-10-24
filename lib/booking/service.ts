import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { activeHolds, availability, BookingError, cohortSchema, HOLD_MS, idSchema, paymentDecision, reserve, searchTokens, validateCapacity, type Attendee, type Booking, type Cohort, type CohortInput, type VerifiedPayment } from "./domain";
import { bookingAccessToken, bookingSignature, secureEqual } from "./security";

export async function listCohorts(programCollection: string, programId: string) {
  const result = await getAdminDb().collection("cohorts").where("programCollection", "==", programCollection).where("programId", "==", programId).where("status", "==", "published").get();
  return result.docs.map((d) => ({ ...d.data(), id: d.id }) as Cohort).sort((a, b) => a.startAt.localeCompare(b.startAt));
}
export async function getCohort(id: string) {
  idSchema.parse(id);
  const document = await getAdminDb().collection("cohorts").doc(id).get();
  if (!document.exists) throw new BookingError("COHORT_NOT_FOUND", 404);
  return { ...document.data(), id: document.id } as Cohort;
}
export async function saveCohort(input: CohortInput, actor: string) {
  const parsed = cohortSchema.parse(input);
  const db = getAdminDb();
  const ref = parsed.id ? db.collection("cohorts").doc(parsed.id) : db.collection("cohorts").doc();
  const audit = db.collection("audit_logs").doc();
  const codeRef = db.collection("cohort_codes").doc(createHash("sha256").update(parsed.cohortCode.toUpperCase()).digest("hex"));
  await db.runTransaction(async (tx) => {
    const previous = await tx.get(ref);
    const program = await tx.get(db.collection(parsed.programCollection).doc(parsed.programId));
    const code = await tx.get(codeRef);
    if (code.exists && code.data()?.cohortId !== ref.id) {
      const existingCohortDoc = await tx.get(db.collection("cohorts").doc(code.data().cohortId));
      if (existingCohortDoc.exists) {
        throw new BookingError("COHORT_CODE_EXISTS", 409);
      }
    }
    if (!program.exists || (parsed.status === "published" && program.data()?.status !== "published")) throw new BookingError("PROGRAM_NOT_PUBLISHED", 400);
    const now = Date.now();
    const old = previous.data() as Cohort | undefined;
    if (old) {
      validateCapacity(old, parsed.capacity, now);
      if (old.programId !== parsed.programId || old.programCollection !== parsed.programCollection) throw new BookingError("COHORT_PROGRAM_IMMUTABLE", 400);
      if (old.cohortCode !== parsed.cohortCode) throw new BookingError("COHORT_CODE_IMMUTABLE", 400);
    }
    tx.set(ref, { ...parsed, id: ref.id, confirmedSeats: old?.confirmedSeats || 0, holds: old ? activeHolds(old, now) : {}, createdAt: old?.createdAt || now, updatedAt: now });
    tx.set(codeRef, { cohortId: ref.id });
    tx.set(audit, { action: old ? "cohort.updated" : "cohort.created", collection: "cohorts", recordId: ref.id, actorUid: actor, at: FieldValue.serverTimestamp() });
  });
  return ref.id;
}
export async function createBooking(cohortId: string, requestKey: string, attendee: Attendee, locale: "ar" | "en", ip: string) {
  const db = getAdminDb();
  const id = createHash("sha256").update(bookingSignature(cohortId + ":" + requestKey, "idempotency")).digest("hex").slice(0, 40);
  const cohortRef = db.collection("cohorts").doc(cohortId);
  const bookingRef = db.collection("bookings").doc(id);
  const limiterRef = db.collection("booking_limits").doc(bookingSignature(ip, "rate-limit"));
  const result = await db.runTransaction(async (tx) => {
    const [cohortDoc, existing, limiter] = await Promise.all([tx.get(cohortRef), tx.get(bookingRef), tx.get(limiterRef)]);
    if (existing.exists) {
      const saved = existing.data() as Booking;
      return saved.status === "PENDING" && saved.holdExpiresAt <= Date.now() ? { ...saved, status: "EXPIRED" as const } : saved;
    }
    if (!cohortDoc.exists) throw new BookingError("COHORT_NOT_FOUND", 404);
    const cohort = cohortDoc.data() as Cohort;
    const program = await tx.get(db.collection(cohort.programCollection).doc(cohort.programId));
    if (program.data()?.status !== "published") throw new BookingError("PROGRAM_NOT_PUBLISHED", 404);
    const existingBookings = await tx.get(db.collection("bookings").where("cohortId", "==", cohortId));
    const alreadyRegistered = existingBookings.docs.some((doc) => {
      const data = doc.data() as Booking;
      return data.status === "CONFIRMED" && data.attendee?.nationalId?.trim() === attendee.nationalId.trim();
    });
    if (alreadyRegistered) throw new BookingError("ALREADY_REGISTERED", 409);
    const now = Date.now();
    const limit = limiter.data();
    if (limit && limit.until > now && limit.count >= 6) throw new BookingError("TOO_MANY_REQUESTS", 429);
    const holds = reserve(cohort, id, now);
    const booking: Booking = { id, bookingNumber: "SEA-" + id.slice(0, 12).toUpperCase(), cohortId, attendee,
      locale, amountMinor: cohort.priceMinor, currency: cohort.currency, status: "PENDING", holdExpiresAt: now + HOLD_MS,
      privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION!, createdAt: now, updatedAt: now,
      searchTokens: searchTokens([attendee.fullName, attendee.email, attendee.nationalId, "SEA-" + id.slice(0, 12).toUpperCase()]) };
    tx.update(cohortRef, { holds, updatedAt: now });
    tx.create(bookingRef, booking);
    tx.set(limiterRef, { count: limit && limit.until > now ? limit.count + 1 : 1, until: limit && limit.until > now ? limit.until : now + 3600000 });
    return booking;
  });
  return { booking: result, accessToken: bookingAccessToken(id) };
}
export async function getBooking(id: string) {
  idSchema.parse(id);
  const db = getAdminDb(); const ref = db.collection("bookings").doc(id);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new BookingError("BOOKING_NOT_FOUND", 404);
    const booking = doc.data() as Booking;
    if (booking.status === "PENDING" && booking.holdExpiresAt <= Date.now()) {
      const cohortRef = db.collection("cohorts").doc(booking.cohortId);
      const cohortDoc = await tx.get(cohortRef); const now = Date.now();
      if (cohortDoc.exists) tx.update(cohortRef, { holds: activeHolds(cohortDoc.data() as Cohort, now), updatedAt: now });
      tx.update(ref, { status: "EXPIRED", updatedAt: now });
      return { ...booking, status: "EXPIRED" as const };
    }
    return booking;
  });
}
export async function settlePayment(payment: VerifiedPayment, eventId: string) {
  idSchema.parse(payment.id); idSchema.parse(eventId);
  const id = payment.metadata?.booking_id || "";
  idSchema.parse(id);
  if (!secureEqual(payment.metadata?.checkout_reference || "", bookingSignature(id, "payment"))) throw new BookingError("PAYMENT_REFERENCE_MISMATCH", 422);
  const expectedLive = process.env.MOYASAR_SECRET_KEY?.startsWith("sk_live_");
  if (typeof payment.live === "boolean" && payment.live !== expectedLive) throw new BookingError("PAYMENT_MODE_MISMATCH", 422);
  const db = getAdminDb();
  const bookingRef = db.collection("bookings").doc(id);
  const eventRef = db.collection("payment_events").doc(eventId);
  const paymentRef = db.collection("payments").doc(payment.id);
  await db.runTransaction(async (tx) => {
    const [doc, event, previousPayment] = await Promise.all([tx.get(bookingRef), tx.get(eventRef), tx.get(paymentRef)]);
    if (event.data()?.state === "processed") return;
    if (!doc.exists) throw new BookingError("BOOKING_NOT_FOUND", 404);
    const previous = previousPayment.data();
    const olderRefund = previous && (previous.refundedMinor || 0) > (payment.refunded || 0);
    const olderStatus = previous && ["paid", "captured", "refunded"].includes(previous.status) && !["paid", "captured", "refunded"].includes(payment.status);
    if (olderRefund || olderStatus) {
      tx.set(eventRef, { state: "processed", paymentId: payment.id, ignoredReason: "stale-provider-snapshot", processedAt: Date.now() }, { merge: true });
      return;
    }
    const booking = doc.data() as Booking;
    const cohortRef = db.collection("cohorts").doc(booking.cohortId);
    const cohortDoc = await tx.get(cohortRef);
    if (!cohortDoc.exists) throw new BookingError("COHORT_NOT_FOUND", 404);
    const now = Date.now();
    const decision = paymentDecision(booking, cohortDoc.data() as Cohort, payment, now);
    tx.update(cohortRef, { holds: decision.holds, confirmedSeats: decision.confirmedSeats, updatedAt: now });
    tx.update(bookingRef, { status: decision.status, ...(decision.paymentId ? { paymentId: decision.paymentId } : {}), ...(decision.status === "CONFIRMED" && !booking.confirmedAt ? { confirmedAt: now } : {}), updatedAt: now });
    tx.set(paymentRef, { id: payment.id, bookingId: id, cohortId: booking.cohortId, amountMinor: payment.amount, currency: payment.currency,
      status: payment.status, refundedMinor: payment.refunded || 0, refundRequired: decision.refundRequired,
      method: payment.source?.company || payment.source?.type || "other", updatedAt: now }, { merge: true });
    tx.set(eventRef, { state: "processed", paymentId: payment.id, processedAt: now }, { merge: true });
    tx.set(db.collection("audit_logs").doc(eventId), { action: "payment." + payment.status, collection: "payments", recordId: payment.id, at: FieldValue.serverTimestamp() });
  });
  return id;
}
export async function cleanupExpired() {
  const db = getAdminDb();
  const rows = await db.collection("bookings").where("status", "==", "PENDING").where("holdExpiresAt", "<=", Date.now()).limit(100).get();
  await Promise.all(rows.docs.map((row) => getBooking(row.id)));
  return rows.size;
}

