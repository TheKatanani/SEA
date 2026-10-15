import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import migration from "./data/migration-map.json";
import content from "./data/claude-content-payload.json";

const staticRoutes = new Set([
  "/", "/about", "/programs", "/admission", "/apply", "/employers", "/gallery",
  "/accreditation", "/accreditation/academie-paris", "/partners", "/partners/cote-dazur",
  "/student-journey", "/policies", "/policies/academic-honesty", "/policies/attendance",
  "/policies/complaints", "/policies/intellectual-property", "/policies/privacy", "/support",
  "/support/trainee-guide", "/support/trainer-guide", "/support/e-learning",
  "/campaigns/future-diploma", "/contact", "/news", "/academic-calendar", "/faq", "/careers",
]);
const programRoutes = new Set(content.programs.map((program) => program.slug_next_proposed));
const routeMap = migration.url_redirects_and_routes as Array<{ legacy: string; next: string }>;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    const sources = new Set<string>();
    return routeMap.flatMap(({ legacy, next }) => {
      if (legacy === next || sources.has(legacy)) return [];
      sources.add(legacy);
      const destination = staticRoutes.has(next) || programRoutes.has(next) ? next : "/programs";
      return [{ source: legacy, destination, permanent: true }];
    }).concat([{ source: "/admissions", destination: "/admission", permanent: true }]);
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
export default withNextIntl(nextConfig);
