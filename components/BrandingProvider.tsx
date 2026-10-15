"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type BrandSettings = {
  logoUrl?: string;
  footerLogoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  fontArabic?: string;
  fontEnglish?: string;
  socialLinks?: Record<string, string>;
  contact?: Record<string, string>;
  navigation?: Array<{ href: string; sortOrder: number; locales: Record<string, { label: string }> }>;
  footerLinks?: Array<{ href: string; sortOrder: number; locales: Record<string, { label: string }> }>;
  locales?: Record<string, { footer?: Record<string, string>; nav?: Record<string, string>; contact?: Record<string, string> }>;
};

const BrandContext = createContext<BrandSettings>({});
const safeColor = (value?: string) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
const safeFont = (value?: string) => value && /^[\w -]{1,60}$/.test(value) ? value : undefined;
const safeWebURL = (value?: string) => {
  if (!value) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : undefined; }
  catch { return undefined; }
};

export function useBrandSettings() {
  return useContext(BrandContext);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandSettings>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site/brand", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        const settings = result?.brand as BrandSettings | undefined;
        if (!settings) return;
        const publicSettings: BrandSettings = {
          ...settings,
          logoUrl: safeWebURL(settings.logoUrl),
          footerLogoUrl: safeWebURL(settings.footerLogoUrl),
          faviconUrl: safeWebURL(settings.faviconUrl),
          socialLinks: Object.fromEntries(Object.entries(settings.socialLinks || {}).map(([key, value]) => [key, safeWebURL(value)]).filter(([, value]) => Boolean(value))) as Record<string, string>,
          navigation: (settings.navigation || []).map((item) => ({ ...item, href: safeWebURL(item.href) || "" })).filter((item) => item.href.startsWith("/")).sort((a, b) => a.sortOrder - b.sortOrder),
          footerLinks: (settings.footerLinks || []).map((item) => ({ ...item, href: safeWebURL(item.href) || "" })).filter((item) => item.href.startsWith("/")).sort((a, b) => a.sortOrder - b.sortOrder),
        };
        setBrand(publicSettings);
        const root = document.documentElement;
        const primary = safeColor(publicSettings.primaryColor);
        const accent = safeColor(publicSettings.accentColor);
        const arabicFont = safeFont(publicSettings.fontArabic);
        const englishFont = safeFont(publicSettings.fontEnglish);
        if (primary) root.style.setProperty("--purple", primary);
        if (accent) root.style.setProperty("--lavender", accent);
        if (arabicFont) root.style.setProperty("--brand-font-ar", `"${arabicFont}", sans-serif`);
        if (englishFont) root.style.setProperty("--brand-font-en", `"${englishFont}", sans-serif`);
        if (publicSettings.faviconUrl) {
          const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement("link");
          favicon.rel = "icon";
          favicon.href = publicSettings.faviconUrl;
          if (!favicon.parentNode) document.head.appendChild(favicon);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}
