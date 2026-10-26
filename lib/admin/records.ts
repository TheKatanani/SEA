import { fieldsFor, getPath, type ContentRecord } from "./content";
export type RecordData = ContentRecord & { id: string };
export type AdminRequest = (url: string, init?: RequestInit) => Promise<Record<string, any>>;
export const inboxCollections = new Set(["applications", "employer_inquiries", "contact_inquiries"]);
export function starterRecord(collection: string): RecordData {
  const id = collection === "brand" ? "main" : collection + "-" + crypto.randomUUID();
  const fields = Object.fromEntries(fieldsFor(collection).map(f => [f.key, f.kind === "list" ? [] : ""]));
  return { id, status: "draft", ...(collection === "pages" ? { path: "/new-page" } : {}), ...(collection === "brand" ? { primaryColor: "#087180", accentColor: "#f1a52d", fontArabic: "IBM Plex Sans Arabic", fontEnglish: "Montserrat" } : {}), ...(collection === "gallery" ? { type: "photo" } : {}), ...(collection === "media" ? { alt: { ar: "", en: "" } } : { locales: { ar: structuredClone(fields), en: structuredClone(fields) } }) };
}
export function recordTitle(item: ContentRecord, en: boolean) {
  return String(getPath(item, `locales.${en ? "en" : "ar"}.title`) || getPath(item, `locales.${en ? "en" : "ar"}.question`) || getPath(item, "fields.fullName") || getPath(item, "fields.contactName") || getPath(item, "fields.company") || item.originalName || item.title || item.action || (en ? "Untitled" : "بلا عنوان"));
}
export const statusLabel = (value: unknown, en: boolean) => ({ draft: ["مسودة", "Draft"], published: ["منشور", "Published"], new: ["جديد", "New"], in_review: ["قيد المراجعة", "In review"], contacted: ["تم التواصل", "Contacted"], accepted: ["مقبول", "Accepted"], closed: ["مغلق", "Closed"] }[String(value)]?.[en ? 1 : 0] || "");
