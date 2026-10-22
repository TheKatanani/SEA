import type { NextRequest } from "next/server";
import { idSchema, publicCohort } from "@/lib/booking/domain";
import { getAdminDb } from "@/lib/firebase/admin";
import { listCohorts } from "@/lib/booking/service";
import { assertBookingEnabled, bookingResponse } from "@/lib/booking/security";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const collection = request.nextUrl.searchParams.get("collection");
    const id = idSchema.parse(request.nextUrl.searchParams.get("programId"));
    if (collection !== "programs" && collection !== "courses") return Response.json({ error: "INVALID_PROGRAM" }, { status: 400 });
    const program = await getAdminDb().collection(collection).doc(id).get();
    if (program.data()?.status !== "published") return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    let bookingEnabled = true; try { assertBookingEnabled(); } catch { bookingEnabled = false; }
    return Response.json({ items: (await listCohorts(collection, id)).map((c) => publicCohort(c)), bookingEnabled }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return bookingResponse(error); }
}

