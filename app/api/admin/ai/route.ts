import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, canManageCollection, authErrorResponse } from "@/lib/firebase/authorization";
import { aiRequestSchema, AssistanceError, generateAssistance } from "@/lib/admin/ai";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin : request.nextUrl.origin;
    try { if (new URL(request.headers.get("origin") || expectedOrigin).origin !== expectedOrigin) return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 }); }
    catch { return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 }); }
    const raw = await request.text(); if (Buffer.byteLength(raw) > 60000) return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
    const body = aiRequestSchema.parse(JSON.parse(raw));
    const allowed = body.collection === "cohorts" ? ["owner", "admin"].includes(user.role) : canManageCollection(user.role, body.collection);
    if (!allowed) return Response.json({ error: "UNAUTHORIZED" }, { status: 403 });
    return Response.json(await generateAssistance(body, user.uid), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AssistanceError) return Response.json({ error: error.code }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "INVALID_AI_REQUEST", details: error instanceof z.ZodError ? error.issues.map(v => ({ path: v.path, message: v.message })) : [] }, { status: 400 });
    return authErrorResponse(error);
  }
}
