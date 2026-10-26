export type Locale = "ar" | "en";
export type ContentRecord = { id?: string; locales?: Record<string, Record<string, unknown>>; [key: string]: unknown };
export type Field = { key: string; ar: string; en: string; kind?: "long" | "list"; optional?: boolean };
export const workAreas = [
  { id: "overview", ar: "نظرة عامة", en: "Overview" }, { id: "training", ar: "التدريب", en: "Training" },
  { id: "inbox", ar: "الطلبات والرسائل", en: "Inbox" }, { id: "website", ar: "محتوى الموقع", en: "Website" },
  { id: "media", ar: "الوسائط", en: "Media" }, { id: "settings", ar: "الإعدادات", en: "Settings" },
] as const;
export const contentResources = [
  ["programs", "البرامج", "Programs", "training"], ["courses", "الدورات", "Courses", "training"],
  ["cohorts", "الدفعات", "Cohorts", "training"], ["bookings", "الحجوزات", "Bookings", "training"], ["payments", "المدفوعات", "Payments", "training"],
  ["applications", "طلبات الاهتمام", "Applications", "inbox"], ["employer_inquiries", "طلبات المنشآت", "Employer inquiries", "inbox"], ["contact_inquiries", "رسائل التواصل", "Contact messages", "inbox"],
  ["pages", "الصفحات", "Pages", "website"], ["news", "الأخبار", "News", "website"], ["calendar", "التقويم", "Calendar", "website"], ["partners", "الشركاء", "Partners", "website"],
  ["faqs", "الأسئلة الشائعة", "FAQs", "website"], ["policies", "السياسات", "Policies", "website"], ["support", "الأدلة والدعم", "Guides", "website"], ["resources", "الوثائق", "Documents", "website"], ["admissions", "متطلبات القبول", "Admissions", "website"], ["forms", "النماذج", "Forms", "website"],
  ["media", "مكتبة الملفات", "Asset library", "media"], ["gallery", "المعرض", "Gallery", "media"],
  ["brand", "الهوية والتواصل", "Brand & contact", "settings"], ["settings", "إعدادات الموقع", "Site settings", "settings"], ["team", "الفريق والصلاحيات", "Team access", "settings"], ["audit_logs", "سجل النشاط", "Activity history", "settings"], ["diagnostics", "جاهزية الخدمات", "Service readiness", "settings"],
] as const;
export const aiCollections = new Set(["pages", "programs", "courses", "news", "calendar", "partners", "faqs", "policies", "support", "resources", "admissions", "forms", "brand", "gallery", "media", "cohorts"]);
const title: Field = { key: "title", ar: "العنوان", en: "Title" };
const description: Field = { key: "description", ar: "الوصف المختصر", en: "Short description", kind: "long" };
const field = (key: string, ar: string, en: string, kind?: Field["kind"], optional = true): Field => ({ key, ar, en, kind, optional });
export function fieldsFor(collection: string): Field[] {
  if (collection === "faqs") return [field("question", "السؤال", "Question", undefined, false), field("answer", "الإجابة", "Answer", "long", false)];
  if (collection === "admissions") return [title, field("requirements", "متطلبات القبول", "Requirements", "list", false), field("documents", "الوثائق المطلوبة", "Required documents", "list")];
  if (collection === "media") return [field("alt", "وصف الملف", "Asset description", undefined, false)];
  if (collection === "cohorts") return [title, field("schedule", "الجدول", "Schedule", "long", false), field("venue", "الموقع", "Venue", undefined, false)];
  if (collection === "policies" || collection === "support") return [title, field("summary", "الملخص", "Summary", "long", false), field("body", "النص", "Text", "long")];
  if (collection === "gallery") return [title, field("caption", "التعليق", "Caption", "long"), field("alt", "وصف الصورة", "Image description", undefined, false)];
  if (collection === "partners") return [title, field("role", "دور الشريك", "Partner role", "long"), field("group", "التصنيف", "Category")];
  if (collection === "resources" || collection === "calendar") return [title, description, field("category", "التصنيف", "Category")];
  const base = [title, description];
  if (collection === "news") base.push(field("body", "نص الخبر", "Article", "long", false));
  if (collection === "programs" || collection === "courses") base.push(field("targetAudience", "الفئة المستهدفة", "Audience", "long"), field("pillars", "محاور التدريب", "Training areas", "list"), field("outcomes", "مخرجات التعلم", "Learning outcomes", "long"), field("careers", "الفرص المهنية", "Career opportunities", "long"), field("requirements", "المتطلبات", "Requirements", "list"), field("documents", "الوثائق المطلوبة", "Required documents", "list"), field("duration", "المدة", "Duration"), field("hoursAndSchedule", "الساعات والجدول", "Hours & schedule"), field("category", "التصنيف", "Category"));
  if (collection === "forms") base.push(field("buttonLabel", "نص زر الإرسال", "Submit button label"));
  if (collection === "pages") base.push(field("seoTitle", "عنوان محركات البحث", "Search title"), field("seoDescription", "وصف محركات البحث", "Search description", "long"));
  return base;
}
export function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value);
}
export function setPath<T>(value: T, path: string, next: unknown): T {
  const copy = structuredClone(value); let current = copy as Record<string, unknown>; const parts = path.split(".");
  if (parts.some(p => ["__proto__", "prototype", "constructor"].includes(p))) throw new Error("Invalid field");
  parts.slice(0, -1).forEach((key, i) => { if (!current[key] || typeof current[key] !== "object") current[key] = /^\d+$/.test(parts[i + 1]) ? [] : {}; current = current[key] as Record<string, unknown>; });
  current[parts[parts.length - 1]] = next; return copy;
}
export function localePath(collection: string, locale: Locale, key: string) {
  if (collection === "brand" && /^(navigation|footerLinks)\.\d{1,2}\.label$/.test(key)) return key.replace(/\.label$/, ".locales." + locale + ".label");
  if (collection === "cohorts") return key + (locale === "ar" ? "Ar" : "En");
  if (collection === "media") return "alt." + locale;
  return "locales." + locale + "." + key;
}
// A content fingerprint, never used as an authentication or payment capability.
export function textHash(text: string) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return (a >>> 0).toString(16) + (b >>> 0).toString(16) + ":" + text.length;
}
export function allowedTextPath(collection: string, key: string) {
  if (!aiCollections.has(collection) || key.length > 150) return false;
  const [head, ...rest] = key.split(".");
  if (fieldsFor(collection).some(f => f.key === head)) return !rest.length || rest.length === 1 && /^\d{1,2}$/.test(rest[0]) && fieldsFor(collection).some(f => f.key === head && f.kind === "list");
  if (["pages", "policies", "support"].includes(collection) && /^sections\.\d{1,2}\.(heading|body|imageAlt|buttonLabel)$/.test(key)) return true;
  if (collection === "forms" && /^fields\.\d{1,2}\.(label|placeholder|options\.\d{1,2})$/.test(key)) return true;
  return collection === "brand" && /^(footer\.(mission|quickLinks|programs|allPrograms|contactUs|allContact|copyright|demo|socialLabel)|nav\.(apply|mainLabel)|contact\.address|(navigation|footerLinks)\.\d{1,2}\.label)$/.test(key);
}
export type TextPair = { key: string; label: string; source: string; target: string };
export function textPairs(collection: string, record: ContentRecord, source: Locale): TextPair[] {
  const target = source === "ar" ? "en" : "ar"; const found: TextPair[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (typeof value === "string" && allowedTextPath(collection, prefix)) found.push({ key: prefix, label: prefix, source: value, target: String(getPath(record, localePath(collection, target, prefix)) ?? "") });
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, prefix ? prefix + "." + i : String(i)));
    else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => walk(v, prefix ? prefix + "." + k : k));
  };
  if (collection === "cohorts") fieldsFor(collection).forEach(f => walk(record[localePath(collection, source, f.key)], f.key));
  else if (collection === "media") walk(getPath(record, "alt." + source), "alt");
  else walk(record.locales?.[source] || {}, "");
  if (collection === "brand") for (const list of ["navigation", "footerLinks"]) { const links = record[list]; if (Array.isArray(links)) links.forEach((_, index) => { const key = list + "." + index + ".label"; walk(getPath(record, localePath(collection, source, key)), key); }); }
  if (collection !== "brand") for (const field of fieldsFor(collection).filter(f => f.kind !== "list")) if (!found.some(v => v.key === field.key)) found.push({ key: field.key, label: field.key, source: "", target: String(getPath(record, localePath(collection, target, field.key)) ?? "") });
  const order = fieldsFor(collection).map(f => f.key);
  return found.sort((a, b) => { const first = order.indexOf(a.key.split(".")[0]), second = order.indexOf(b.key.split(".")[0]); return (first < 0 ? 999 : first) - (second < 0 ? 999 : second); }).slice(0, 400);
}
export function applyText(record: ContentRecord, collection: string, locale: Locale, key: string, text: string, sourceLocale?: Locale) {
  if (!allowedTextPath(collection, key)) throw new Error("Unsupported content field");
  let next = record;
  if (sourceLocale && ["pages", "policies", "support"].includes(collection) && key.startsWith("sections.")) {
    const index = key.split(".")[1], path = `locales.${locale}.sections.${index}`;
    const original = getPath(record, `locales.${sourceLocale}.sections.${index}`);
    if (!getPath(record, path) && original && typeof original === "object") next = setPath(next, path, { ...original, heading: "", body: "", imageAlt: "", buttonLabel: "" });
  }
  if (sourceLocale && collection === "forms" && key.startsWith("fields.")) {
    const index = key.split(".")[1]; const source = getPath(record, `locales.${sourceLocale}.fields.${index}`) as Record<string, unknown> | undefined;
    const existing = getPath(record, `locales.${locale}.fields.${index}`) as Record<string, unknown> | undefined;
    if (existing?.name && existing.name !== source?.name) throw new Error("Form fields must have matching names before translation");
    if (!existing && source) next = setPath(next, `locales.${locale}.fields.${index}`, { ...source, label: "", placeholder: "", ...(Array.isArray(source.options) ? { options: source.options.map(() => "") } : {}) });
  }
  return setPath(next, localePath(collection, locale, key), text);
}
export type TranslationEntry = { sourceHash: string; targetHash: string; status: "missing" | "suggested" | "reviewed" | "outdated"; origin: "ai" | "manual" };
export type TranslationState = Record<string, TranslationEntry>;
export function buildTranslationState(collection: string, record: ContentRecord, previous: ContentRecord | undefined, prior: TranslationState = {}, reviewed: string[] = [], aiPaths: string[] = []): TranslationState {
  const result: TranslationState = {};
  for (const locale of ["ar", "en"] as const) for (const pair of textPairs(collection, record, locale)) {
    if (!pair.source.trim()) continue;
    const key = locale + ":" + pair.key; const old = prior[key];
    const previousPair = previous && textPairs(collection, previous, locale).find(p => p.key === pair.key);
    const sourceHash = textHash(pair.source), targetHash = textHash(pair.target);
    const same = old ? old.sourceHash === sourceHash && old.targetHash === targetHash : Boolean(previousPair?.target.trim() && previousPair.source === pair.source && previousPair.target === pair.target);
    result[key] = { sourceHash, targetHash, origin: aiPaths.includes(key) ? "ai" : old?.origin || "manual", status: !pair.target.trim() ? "missing" : reviewed.includes(key) ? "reviewed" : same ? old?.status || "reviewed" : previousPair?.source && previousPair.source !== pair.source ? "outdated" : "suggested" };
  }
  return result;
}
