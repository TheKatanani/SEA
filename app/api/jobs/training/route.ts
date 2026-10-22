import type { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { cleanupExpired, settlePayment } from "@/lib/booking/service";
import { bookingResponse, secureEqual } from "@/lib/booking/security";
import { fetchMoyasarPayment } from "@/lib/payments/moyasar";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const secret = process.env.TRAINING_JOB_SECRET;
  if (!secret || !secureEqual(request.headers.get("authorization") || "", "Bearer " + secret)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const expired = await cleanupExpired();
    const events = await getAdminDb().collection("payment_events").where("state", "==", "received").limit(25).get();
    let processed = 0;
    for (const event of events.docs) {
      try { await settlePayment(await fetchMoyasarPayment(event.data().paymentId), event.id); processed++; }
      catch { /* Retain the durable event for the next attempt and the admin review queue. */ }
    }
    return Response.json({ expired, processed, remaining: events.size - processed });
  } catch (error) { return bookingResponse(error); }
}

