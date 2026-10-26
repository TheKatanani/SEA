import type { NextRequest } from "next/server";
import { requireAdmin, canManageCollection, authErrorResponse } from "@/lib/firebase/authorization";
import { contentResources, workAreas } from "@/lib/admin/content";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const identity = await requireAdmin(request);
    const manager = ["owner", "admin"].includes(identity.role);
    const resources = contentResources.filter(([id]) => ["cohorts", "bookings", "payments", "team", "diagnostics"].includes(id) ? manager : canManageCollection(identity.role, id)).map(([id]) => id);
    const areas = workAreas.filter(area => area.id === "overview" || contentResources.some(([id, , , parent]) => parent === area.id && resources.includes(id))).map(area => area.id);
    return Response.json({ role: identity.role, resources, areas, aiAvailable: Boolean(process.env.GEMINI_API_KEY?.trim()) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error); }
}
