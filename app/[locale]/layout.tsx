import type { Metadata } from "next";
import "../globals.css";
import "../training.css";
import "../responsive-fixes.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/i18n/routing";
import { BrandingProvider } from "@/components/BrandingProvider";
import { SiteChrome } from "@/components/SiteChrome";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await params;
  return {
    title: { default: "SEA", template: "%s | SEA" },
    alternates: { languages: { ar: "/", en: "/en" } },
  };
}

export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const direction = locale === "ar" ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={direction}>
      <body className={`locale-${locale}`}>
        <NextIntlClientProvider messages={messages}>
          <BrandingProvider>
            <SiteChrome>{children}</SiteChrome>
          </BrandingProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
