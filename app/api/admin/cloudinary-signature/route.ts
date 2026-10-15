import { v2 as cloudinary } from "cloudinary";
import type { NextRequest } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/firebase/authorization";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireAdmin(request, ["owner", "admin", "editor", "media"]);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) return Response.json({ error: "Cloudinary is not configured" }, { status: 503 });
    const folder = "sea/website";
    const timestamp = Math.floor(Date.now() / 1000);
    const allowedFormats = "jpg,jpeg,png,webp,svg,pdf,mp4,mov";
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp, allowed_formats: allowedFormats }, apiSecret);
    return Response.json({ cloudName, apiKey, timestamp, folder, allowedFormats, signature, uploadedBy: identity.uid });
  } catch (error) {
    return authErrorResponse(error);
  }
}
