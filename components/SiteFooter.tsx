"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { ArrowUpLeft, ArrowUpRight, Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useBrandSettings } from "@/components/BrandingProvider";
import { useEffect, useState } from "react";

type FooterProgram = { id: string; slug?: string; href?: string; isDiploma?: boolean; locales?: Record<string, { title?: string }> };

function SocialIcon({ platform }: { platform: string }) {
  if (platform === "facebook") return <Facebook aria-hidden="true" />;
  if (platform === "instagram") return <Instagram aria-hidden="true" />;
  if (platform === "tiktok") return <svg viewBox="0 0 24 24" role="img" aria-label="TikTok"><path fill="currentColor" d="M19.6 6.4a5.4 5.4 0 0 1-3.7-1.5v8.2a6.1 6.1 0 1 1-5.3-6.1v3.2a3 3 0 1 0 2.1 2.9V1.5h3.2c.2 2.3 1.6 4.2 3.7 4.9z" /></svg>;
  if (platform === "x") return (
    <svg viewBox="0 0 24 24" role="img" aria-label="X">
      <path fill="currentColor" d="M18.901 1.153h3.68L14.54 10.23 24 22.846h-7.406l-5.8-7.584-6.639 7.584H.473l8.583-9.816L-.001 1.153h7.594l5.243 6.932zm-1.293 19.472h2.039L6.486 3.258H4.298z" />
    </svg>
  );
  return null;
}

export function SiteFooter() {
  const locale = useLocale();
  const english = locale === "en";
  const brand = useBrandSettings();
  const footer = brand.locales?.[english ? "en" : "ar"]?.footer || {};
  const Arrow = english ? ArrowUpRight : ArrowUpLeft;
  const [programs, setPrograms] = useState<FooterProgram[]>([]);
  const footerSocialLinks = Object.entries(brand.socialLinks || {}).filter(([platform]) => ["instagram", "facebook", "x", "tiktok"].includes(platform)).map(([platform, href]) => ({ platform, href, label: platform }));
  const contact = { ...(brand.contact || {}), ...(brand.locales?.[english ? "en" : "ar"]?.contact || {}) };
  const mapHref = typeof contact.map === "string" && /^https:\/\//i.test(contact.map) ? contact.map : "";
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site/content?collection=programs", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => setPrograms(Array.isArray(result?.items) ? result.items.filter((item: FooterProgram) => item.isDiploma) : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__inner">
        <div className="site-footer__columns">
          <div className="footer-brand">
            <Link href="/" aria-label={footer.homeLabel || "SEA"}>
              {brand.footerLogoUrl ? <Image src={brand.footerLogoUrl} alt={footer.homeLabel || "SEA"} width={320} height={264} unoptimized /> : <span className="footer-brand-fallback">SEA</span>}
            </Link>
            {footer.mission && <p>{footer.mission}</p>}
            <div className="social-links" aria-label={footer.socialLabel || ""}>
              {footerSocialLinks.map((item) => (
                <a key={item.label} className={`social-link social-link--${item.platform}`} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label}>
                  <SocialIcon platform={item.platform} />
                </a>
              ))}
            </div>
          </div>

          {brand.footerLinks?.length ? <div className="footer-list">
            <h2>{footer.quickLinks || ""}</h2>
            {brand.footerLinks.map((item, index) => <Link key={`${item.href}-${index}`} href={item.href}>{item.locales?.[english ? "en" : "ar"]?.label || ""}</Link>)}
          </div> : null}

          {footer.programs && <div className="footer-list">
            <h2>{footer.programs}</h2>
            {footer.allPrograms && <Link href="/programs">{footer.allPrograms}</Link>}
            {programs.slice(0, 5).map((program) => <Link key={program.id} href={program.href || `/programs/${program.slug || program.id}`}>{program.locales?.[english ? "en" : "ar"]?.title || ""}</Link>)}
          </div>}

          {(footer.contactUs || Object.values(contact).some(Boolean)) && <div className="footer-contact">
            {footer.contactUs && <h2>{footer.contactUs}</h2>}
            {(contact.address || contact.postal) && <p><MapPin size={17} aria-hidden="true" /> {mapHref ? <a href={mapHref} target="_blank" rel="noreferrer">{[contact.address, contact.postal].filter(Boolean).join(" — ")}</a> : [contact.address, contact.postal].filter(Boolean).join(" — ")}</p>}
            {contact.email && <a href={`mailto:${contact.email}`}><Mail size={17} aria-hidden="true" /> <span dir="ltr">{contact.email}</span></a>}
            {contact.recruitment && <a href={`mailto:${contact.recruitment}`}><Mail size={17} aria-hidden="true" /> <span dir="ltr">{contact.recruitment}</span></a>}
            {contact.phone && <a href={`tel:${contact.phone.replaceAll(" ", "")}`}><Phone size={17} aria-hidden="true" /> <span dir="ltr">{contact.phone}</span></a>}
            {footer.allContact && <Link className="footer-contact__cta" href="/contact">{footer.allContact} <Arrow size={15} aria-hidden="true" /></Link>}
          </div>}
        </div>
        <div className="site-footer__bottom">
          <p>{footer.copyright ? `© ${new Date().getFullYear()} ${footer.copyright}` : `© ${new Date().getFullYear()}`}</p>
          {footer.demo && <p>{footer.demo}</p>}
        </div>
      </div>
    </footer>
  );
}
