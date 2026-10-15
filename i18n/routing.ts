import { defineRouting } from "next-intl/routing";

export const locales = ["ar", "en"] as const;
export const defaultLocale = "ar" as const;

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed" as const,
});
