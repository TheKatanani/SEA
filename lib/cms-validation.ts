import { z } from "zod";
const text = z.string().max(100_000);
const url = z.string().max(2000).refine((s) => !s || (/^\/(?!\/)/.test(s) && !s.includes("\\")) || /^https:\/\//.test(s), "Use a relative path or HTTPS URL");
const field = z.object({ name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/), label: z.string().min(1).max(200), type: z.enum(["text", "email", "tel", "select", "textarea"]).optional(), required: z.boolean().optional(), options: z.array(z.string().max(300)).max(200).optional(), placeholder: z.string().max(500).optional(), full: z.boolean().optional() });
const section = z.object({ type: z.enum(["text", "collection", "record", "form"]).optional(), collection: z.enum(["programs", "courses", "news", "calendar", "gallery", "faqs", "partners", "policies", "support", "admissions", "resources"]).optional(), recordId: z.string().max(180).optional(), formType: z.enum(["quick_interest", "application_interest", "employer_inquiry", "future_diploma_interest", "contact_inquiry"]).optional(), heading: z.string().max(300).optional(), body: text.optional(), imageUrl: url.optional(), imagePublicId: z.string().max(300).optional(), imageAlt: z.string().max(500).optional(), buttonLabel: z.string().max(120).optional(), buttonUrl: url.optional() });
const contact = z.object({ address: z.string().max(500).optional(), postal: z.string().max(200).optional(), email: z.string().max(254).optional(), phone: z.string().max(40).optional(), recruitment: z.string().max(254).optional(), map: url.optional() });
const translation = z.object({
  title: text.optional(), description: text.optional(), summary: text.optional(), body: text.optional(),
  seoTitle: z.string().max(300).optional(), seoDescription: z.string().max(2000).optional(),
  question: text.optional(), answer: text.optional(), role: text.optional(), group: text.optional(), caption: text.optional(), alt: text.optional(), imageAlt: text.optional(),
  category: text.optional(), status: text.optional(), duration: text.optional(), hoursAndSchedule: text.optional(), targetAudience: text.optional(),
  outcomes: text.optional(), careers: text.optional(), requirements: z.union([text, z.array(text).max(100)]).optional(), documents: z.array(text).max(100).optional(), pillars: z.array(text).max(100).optional(),
  sections: z.array(section).max(30).optional(), fields: z.array(field).max(50).optional(), buttonLabel: z.string().max(200).optional(),
  footer: z.record(z.string().max(1000)).optional(), nav: z.record(z.string().max(300)).optional(), contact: contact.optional(),
});
const locales = z.object({ ar: translation.optional(), en: translation.optional() });
const navigation = z.array(z.object({ href: url, sortOrder: z.number().int().min(0).max(1000), locales: z.object({ ar: z.object({ label: z.string().max(200) }), en: z.object({ label: z.string().max(200) }) }) })).max(50);
const schema = z.object({
  status: z.enum(["draft", "published"]), locales: locales.optional(), path: z.string().regex(/^\/[A-Za-z0-9/_-]*$/).max(200).optional(),
  slug: z.string().regex(/^[A-Za-z0-9_-]{1,150}$/).optional(), href: url.optional(), type: z.string().max(40).optional(), category: z.string().max(100).optional(), isDiploma: z.boolean().optional(), featured: z.boolean().optional(),
  source: url.optional(), imageUrl: url.optional(), image: url.optional(), imagePublicId: z.string().max(300).optional(), publicId: z.string().max(300).optional(), url: url.optional(), documentUrl: url.optional(), thumbnailUrl: url.optional(),
  resourceType: z.enum(["image", "video", "raw"]).optional(), format: z.string().max(30).optional(), originalName: z.string().max(300).optional(),
  width: z.number().nonnegative().optional(), height: z.number().nonnegative().optional(), bytes: z.number().nonnegative().optional(), sortOrder: z.number().int().optional(),
  eventDate: z.string().max(100).optional(), startDate: z.string().max(100).optional(), endDate: z.string().max(100).optional(), location: z.string().max(500).optional(), price: z.union([z.string().max(100), z.number().nonnegative()]).optional(), duration: z.string().max(200).optional(),
  formType: z.string().max(100).optional(), title: text.optional(), name: text.optional(), description: text.optional(), statusLabel: text.optional(),
  logoUrl: url.optional(), footerLogoUrl: url.optional(), faviconUrl: url.optional(), logoPublicId: z.string().max(300).optional(), footerLogoPublicId: z.string().max(300).optional(), faviconPublicId: z.string().max(300).optional(),
  primaryColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(), accentColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(), fontArabic: z.string().regex(/^[\w -]{1,60}$/).optional(), fontEnglish: z.string().regex(/^[\w -]{1,60}$/).optional(),
  contact: contact.optional(), socialLinks: z.record(url).optional(), navigation: navigation.optional(), footerLinks: navigation.optional(),
  alt: z.object({ ar: z.string().max(1000).optional(), en: z.string().max(1000).optional() }).optional(),
});
export function validateCmsRecord(collection: string, data: Record<string, unknown>) {
  const result = schema.parse(data);
  if (result.status === "published" && ["pages", "programs", "courses", "policies", "support"].includes(collection)) {
    if (!result.locales?.ar?.title?.trim() || !result.locales?.en?.title?.trim()) throw new z.ZodError([{ code: "custom", path: ["locales"], message: "Both language titles are required to publish" }]);
  }
  if (result.status === "published" && collection === "forms") {
    for (const locale of ["ar", "en"] as const) {
      const fields = result.locales?.[locale]?.fields;
      if (!fields?.length || fields.some((f) => f.type === "select" && !f.options?.length)) throw new z.ZodError([{ code: "custom", path: ["locales"], message: "Both language forms require configured fields and choices" }]);
    }
  }
  if (collection === "pages" && !result.path) throw new z.ZodError([{ code: "custom", path: ["locales"], message: "Page path is required" }]);
  return result;
}

