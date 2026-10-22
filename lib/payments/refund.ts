import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { BookingError } from "@/lib/booking/domain";
import { settlePayment } from "@/lib/booking/service";
import { fetchMoyasarPayment } from "./moyasar";
export async function refundPayment(id: string, actorUid: string) {
  const db = getAdminDb(); const ref = db.collection("payments").doc(id);
  const record = await ref.get();
  if (!record.exists) throw new BookingError("PAYMENT_NOT_FOUND", 404);
  const current = await fetchMoyasarPayment(id);
  if ((current.refunded || 0) >= current.amount) {
    await settlePayment(current, "refund_verified_" + id);
    return;
  }
  if (!["paid", "captured", "refunded"].includes(current.status)) throw new BookingError("PAYMENT_NOT_REFUNDABLE", 409);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (["requested", "unknown"].includes(snapshot.data()?.refundState)) throw new BookingError("REFUND_OUTCOME_PENDING_RECONCILE_FIRST", 409);
    tx.update(ref, { refundState: "requested", refundActor: actorUid, refundRequestedAt: Date.now() });
    tx.create(db.collection("audit_logs").doc(), { action: "payment.refund.requested", collection: "payments", recordId: id, actorUid, at: FieldValue.serverTimestamp() });
  });
  try {
    const secret = process.env.MOYASAR_SECRET_KEY;
    if (!secret) throw new BookingError("PAYMENT_NOT_CONFIGURED", 503);
    const response = await fetch("https://api.moyasar.com/v1/payments/" + encodeURIComponent(id) + "/refund", {
      method: "POST", headers: { Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: current.amount - (current.refunded || 0) }), signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    if (!response.ok) {
      await ref.update({ refundState: response.status < 500 ? "rejected" : "unknown" });
      throw new BookingError("REFUND_PROVIDER_REVIEW_REQUIRED", 502);
    }
    const verified = await fetchMoyasarPayment(id);
    await settlePayment(verified, "refund_" + id + "_" + (verified.refunded || 0));
    await ref.update({ refundState: (verified.refunded || 0) >= verified.amount ? "completed" : "unknown" });
  } catch (error) {
    const latest = await ref.get();
    if (latest.data()?.refundState === "requested") await ref.update({ refundState: "unknown" });
    throw error;
  }
}

