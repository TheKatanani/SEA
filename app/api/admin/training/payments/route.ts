import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, authErrorResponse } from "@/lib/firebase/authorization";
import { idSchema } from "@/lib/booking/domain";
import { getAdminDb } from "@/lib/firebase/admin";
import { settlePayment } from "@/lib/booking/service";
import { bookingResponse } from "@/lib/booking/security";
import { refundPayment } from "@/lib/payments/refund";
import { fetchMoyasarPayment } from "@/lib/payments/moyasar";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const identity = await requireAdmin(request, ["owner", "admin"]);
    const body = z.object({ paymentId: idSchema, action: z.enum(["reconcile", "refund"]), confirm: z.boolean().optional() }).strict().parse(await request.json());
    const record = await getAdminDb().collection("payments").doc(body.paymentId).get();
    if (!record.exists) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    if (body.action === "refund") { if (body.confirm !== true) return Response.json({ error: "CONFIRMATION_REQUIRED" }, { status: 400 }); await refundPayment(body.paymentId, identity.uid); return Response.json({ ok: true }); }
    const payment = await fetchMoyasarPayment(body.paymentId);
    await settlePayment(payment, "reconcile_" + payment.id + "_" + payment.status + "_" + (payment.refunded || 0));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
    if (error instanceof Error && error.name === "AdminAuthError") return authErrorResponse(error);
    return bookingResponse(error);
  }
}

