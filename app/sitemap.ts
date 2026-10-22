import type { MetadataRoute } from "next";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base || process.env.SITE_INDEXING_ENABLED !== "true" || !isFirebaseAdminConfigured()) return [];
  const pages = await getAdminDb().collection("pages").where("status", "==", "published").limit(1000).get();
  return pages.docs.flatMap((doc) => {
    const page = doc.data();
    if (typeof page.path !== "string" || !/^\/[A-Za-z0-9/_-]*$/.test(page.path) || /^\/(admin|checkout|booking|api)(\/|$)/.test(page.path)) return [];
    const paths = { ar: base + page.path, en: base + "/en" + (page.path === "/" ? "" : page.path) };
    return (["ar", "en"] as const).filter((locale) => typeof page.locales?.[locale]?.title === "string").map((locale) => ({
      url: paths[locale], alternates: { languages: paths },
      ...(page.updatedAt?.toDate ? { lastModified: page.updatedAt.toDate() } : {}),
    }));
  });
}

