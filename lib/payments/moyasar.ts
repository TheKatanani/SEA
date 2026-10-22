import "server-only";
import { BookingError, type VerifiedPayment } from "@/lib/booking/domain";

export async function fetchMoyasarPayment(id: string): Promise<VerifiedPayment> {
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(id)) throw new BookingError("INVALID_PAYMENT_ID", 400);
  const secret = process.env.MOYASAR_SECRET_KEY;
  if (!secret) throw new BookingError("PAYMENT_NOT_CONFIGURED", 503);
  const response = await fetch("https://api.moyasar.com/v1/payments/" + encodeURIComponent(id), {
    headers: { Authorization: "Basic " + Buffer.from(secret + ":").toString("base64") },
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new BookingError("PAYMENT_VERIFICATION_FAILED", 502);
  const value = await response.json();
  if (value.id !== id || !Number.isSafeInteger(value.amount) || typeof value.currency !== "string" || typeof value.status !== "string") throw new BookingError("INVALID_PROVIDER_RESPONSE", 502);
  return value as VerifiedPayment;
}

