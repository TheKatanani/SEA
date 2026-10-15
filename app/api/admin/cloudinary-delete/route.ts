import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/firebase/authorization";

export const runtime = "nodejs";

const requestSchema = z.object({
  publicId: z.string().min(1).max(300).regex(/^sea\/website\/[A-Za-z0-9/_-]+$/),
  resourceType: z.enum(["image", "video", "raw"]).default("image"),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request, ["owner", "admin", "editor", "media"]);
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!apiKey || !apiSecret || !cloudName) return Response.json({ error: "Cloudinary is not configured" }, { status: 503 });
    const body = requestSchema.parse(await request.json());
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    const result = await cloudinary.uploader.destroy(body.publicId, { resource_type: body.resourceType, invalidate: true });
    if (result.result !== "ok" && result.result !== "not found") return Response.json({ error: "Cloudinary could not delete this image" }, { status: 502 });
    return Response.json({ ok: true, result: result.result });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid Cloudinary asset" }, { status: 400 });
    return authErrorResponse(error);
  }
}
