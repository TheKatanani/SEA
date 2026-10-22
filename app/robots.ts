import type { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base || process.env.SITE_INDEXING_ENABLED !== "true") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/en/admin", "/checkout/", "/en/checkout/", "/booking/", "/en/booking/"] }, sitemap: base + "/sitemap.xml" };
}

