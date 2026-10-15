"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpLeft, ArrowUpRight, Languages, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useBrandSettings } from "@/components/BrandingProvider";

export function SiteHeader() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);
  const brand = useBrandSettings();
  const english = locale === "en";
  const navText = brand.locales?.[english ? "en" : "ar"]?.nav || {};
  const navItems = brand.navigation || [];

  function switchLocale() {
    router.replace(pathname, { locale: english ? "ar" : "en" });
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="site-header__inner page-shell">
        <Link className="brand" href="/" aria-label={english ? "Saudi Entertainment Academy — Home" : "الأكاديمية السعودية للترفيه — الرئيسية"} onClick={() => setMenuOpen(false)}>
          {brand.logoUrl ? <Image src={brand.logoUrl} alt="SEA — Saudi Entertainment Academy" width={360} height={180} priority unoptimized /> : <span className="brand-fallback">SEA</span>}
        </Link>

        <nav className={`site-nav ${menuOpen ? "site-nav--open" : ""}`} aria-label={navText.mainLabel || t("mainLabel")}>
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`site-nav__link ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.locales?.[english ? "en" : "ar"]?.label || ""}
              </Link>
            );
          })}
        </nav>

        <div className="site-header__actions">
          {navText.apply && <Link className="button button--primary button--small header-cta" href="/apply">
            {navText.apply} {english ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowUpLeft size={15} aria-hidden="true" />}
          </Link>}
          <button className="language-toggle" type="button" onClick={switchLocale} aria-label={t("switchLanguage")} title={t("switchLanguage")}>
            <Languages size={16} aria-hidden="true" /><span>{english ? "عربي" : "EN"}</span>
          </button>
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
