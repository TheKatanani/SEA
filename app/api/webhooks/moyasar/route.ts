import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { idSchema } from "@/lib/booking/domain";
import { bookingResponse, secureEqual } from "@/lib/booking/security";
import { settlePayment } from "@/lib/booking/service";
import { fetchMoyasarPayment } from "@/lib/payments/moyasar";
export const runtime = "nodejs";
const schema = z.object({ id: idSchema, type: z.string().max(80), secret_token: z.string().max(500), live: z.boolean(), data: z.object({ id: idSchema }) });
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.MOYASAR_WEBHOOK_SECRET;
    if (!secret) return Response.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 64000) return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const event = schema.parse(JSON.parse(raw));
    if (!secureEqual(event.secret_token, secret)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (event.live !== process.env.MOYASAR_SECRET_KEY?.startsWith("sk_live_")) return Response.json({ error: "MODE_MISMATCH" }, { status: 422 });
    if (!["payment_paid", "payment_failed", "payment_refunded", "payment_captured", "payment_voided"].includes(event.type)) return Response.json({ ok: true });
    const ref = getAdminDb().collection("payment_events").doc(event.id);
    const saved = await ref.get();
    if (saved.data()?.state === "processed") return Response.json({ ok: true });
    await ref.set({ paymentId: event.data.id, type: event.type, state: "received", receivedAt: Date.now() }, { merge: true });
    const payment = await fetchMoyasarPayment(event.data.id);
    await settlePayment(payment, event.id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "INVALID_EVENT" }, { status: 400 });
    return bookingResponse(error);
  }
}

