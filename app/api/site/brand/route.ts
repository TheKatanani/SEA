import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isFirebaseAdminConfigured()) return Response.json({ brand: null }, { headers: { "Cache-Control": "no-store" } });
  try {
    const snapshot = await getAdminDb().collection("brand").doc("main").get();
    const data = snapshot.data();
    if (!data || data.status !== "published") return Response.json({ brand: null }, { headers: { "Cache-Control": "no-store" } });
    const { logoUrl, footerLogoUrl, faviconUrl, primaryColor, accentColor, fontArabic, fontEnglish } = data;
    const contact = data.contact && typeof data.contact === "object" ? Object.fromEntries(["address", "postal", "email", "phone", "recruitment", "map"].map((key) => [key, data.contact[key]])) : {};
    const socialLinks = data.socialLinks && typeof data.socialLinks === "object" ? Object.fromEntries(["instagram", "facebook", "x", "tiktok"].map((key) => [key, data.socialLinks[key]])) : {};
    const publicLinks = (value: unknown) => Array.isArray(value) ? value.slice(0, 30).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const href = typeof item.href === "string" && item.href.startsWith("/") && !item.href.startsWith("//") ? item.href.slice(0, 300) : "";
      if (!href) return [];
      const locales = item.locales && typeof item.locales === "object" ? item.locales as Record<string, Record<string, unknown>> : {};
      return [{ href, sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0, locales: Object.fromEntries(["ar", "en"].map((locale) => [locale, { label: typeof locales[locale]?.label === "string" ? (locales[locale].label as string).slice(0, 200) : "" }])) }];
    }) : [];
    const rawLocales = data.locales && typeof data.locales === "object" ? data.locales as Record<string, Record<string, unknown>> : {};
    const textValues = (value: unknown, keys: string[]) => {
      const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return Object.fromEntries(keys.flatMap((key) => typeof source[key] === "string" ? [[key, (source[key] as string).slice(0, 500)]] : []));
    };
    const footerKeys = ["homeLabel", "mission", "socialLabel", "quickLinks", "admission", "journey", "support", "policies", "paris", "contact", "programs", "allPrograms", "contactUs", "allContact", "copyright", "demo"];
    const navKeys = ["home", "about", "programs", "admission", "employers", "partners", "gallery", "apply", "mainLabel", "openMenu", "closeMenu", "switchLanguage"];
    const locales = Object.fromEntries(["ar", "en"].map((locale) => {
      const value = rawLocales[locale] || {};
      return [locale, { footer: textValues(value.footer, footerKeys), nav: textValues(value.nav, navKeys), contact: textValues(value.contact, ["address", "postal", "email", "phone", "recruitment", "map"]) }];
    }));
    return Response.json({ brand: { logoUrl, footerLogoUrl, faviconUrl, primaryColor, accentColor, fontArabic, fontEnglish, socialLinks, contact, navigation: publicLinks(data.navigation), footerLinks: publicLinks(data.footerLinks), locales } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Published brand read failed", error);
    return Response.json({ brand: null }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
