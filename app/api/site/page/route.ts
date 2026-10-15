import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") || "/";
  const locale = request.nextUrl.searchParams.get("locale") || "ar";
  if (!path.startsWith("/") || path.includes("..") || !["ar", "en"].includes(locale)) {
    return Response.json({ error: "Invalid page request" }, { status: 400 });
  }
  if (!isFirebaseAdminConfigured()) return Response.json({ state: "unavailable", page: null }, { headers: { "Cache-Control": "no-store" } });

  try {
    const id = path.replace(/^\/+|\/+$/g, "").replaceAll("/", "__") || "home";
    const snapshot = await getAdminDb().collection("pages").doc(id).get();
    const document = snapshot.data();
    if (!document) return Response.json({ state: "missing", page: null }, { headers: { "Cache-Control": "no-store" } });
    if (document.status !== "published") return Response.json({ state: "draft", page: null }, { headers: { "Cache-Control": "no-store" } });
    const translation = document.locales?.[locale];
    if (!translation || typeof translation.title !== "string") return Response.json({ state: "missing", page: null }, { headers: { "Cache-Control": "no-store" } });
    const sections = Array.isArray(translation.sections) ? translation.sections.slice(0, 30).map((section: Record<string, unknown>) => ({
      type: ["text", "collection", "record", "form"].includes(String(section.type)) ? section.type : "text",
      collection: typeof section.collection === "string" && ["programs", "courses", "gallery", "faqs", "partners", "policies", "support", "resources", "calendar", "admissions", "news"].includes(section.collection) ? section.collection : undefined,
      recordId: typeof section.recordId === "string" ? section.recordId.slice(0, 180) : undefined,
      formType: typeof section.formType === "string" && ["quick_interest", "application_interest", "employer_inquiry", "future_diploma_interest", "contact_inquiry"].includes(section.formType) ? section.formType : undefined,
      heading: typeof section.heading === "string" ? section.heading.slice(0, 300) : undefined,
      body: typeof section.body === "string" ? section.body.slice(0, 10_000) : undefined,
      imageUrl: typeof section.imageUrl === "string" ? section.imageUrl.slice(0, 2_000) : undefined,
      imageAlt: typeof section.imageAlt === "string" ? section.imageAlt.slice(0, 500) : undefined,
      buttonLabel: typeof section.buttonLabel === "string" ? section.buttonLabel.slice(0, 120) : undefined,
      buttonUrl: typeof section.buttonUrl === "string" ? section.buttonUrl.slice(0, 2_000) : undefined,
    })) : [];
    return Response.json({ state: "published", page: { path, locale, title: translation.title.slice(0, 300), description: typeof translation.description === "string" ? translation.description.slice(0, 2_000) : undefined, seoTitle: typeof translation.seoTitle === "string" ? translation.seoTitle.slice(0, 300) : undefined, seoDescription: typeof translation.seoDescription === "string" ? translation.seoDescription.slice(0, 500) : undefined, sections } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Published page read failed", error);
    return Response.json({ state: "unavailable", page: null }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
