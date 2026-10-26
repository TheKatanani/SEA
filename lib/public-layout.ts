export const normalizedCopy = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase() : "";
export function uniqueCopy(values: unknown[], omitted: unknown[] = []) {
  const seen = new Set(omitted.map(normalizedCopy).filter(Boolean));
  return values.filter((value): value is string => { const key = normalizedCopy(value); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}
type Section = { type?: string; collection?: string; recordId?: string; formType?: string; heading?: string; body?: string; imageUrl?: string; buttonUrl?: string; buttonLabel?: string };
export function cleanSections<T extends Section>(sections: T[], title: unknown, intro: unknown): T[] {
  const seen = new Set<string>(); const result: T[] = [];
  for (const raw of sections) {
    const section = { ...raw };
    if (normalizedCopy(section.heading) === normalizedCopy(title)) section.heading = "";
    if (normalizedCopy(section.body) === normalizedCopy(intro)) section.body = "";
    const key = section.type === "collection" ? "collection:" + section.collection : section.type === "record" ? "record:" + section.collection + ":" + section.recordId : section.type === "form" ? "form:" + section.formType : "text:" + normalizedCopy(section.body) + ":" + (section.imageUrl || "") + ":" + (section.buttonUrl || "");
    if ((!section.type || section.type === "text") && !section.body?.trim() && !section.imageUrl && !(section.buttonLabel && section.buttonUrl)) continue;
    if (seen.has(key)) continue; seen.add(key); result.push(section);
  }
  return result;
}
export function usefulPublicRecord(collection: string, item: Record<string, unknown>, locale: "ar" | "en") {
  const locales = item.locales as Record<string, Record<string, unknown>> | undefined, text = locales?.[locale] || {};
  if (collection === "gallery") return Boolean(item.imageUrl || item.url || item.thumbnailUrl);
  if (collection === "faqs") return Boolean(normalizedCopy(text.question || text.title) && normalizedCopy(text.answer || text.body));
  if (!normalizedCopy(text.title || item.title || item.name)) return false;
  if (["programs", "courses"].includes(collection)) return true;
  if (collection === "admissions") return [text.requirements, text.documents].some(v => Array.isArray(v) && v.some(normalizedCopy));
  const body = Array.isArray(text.sections) && text.sections.some(s => s && typeof s === "object" && normalizedCopy((s as Record<string, unknown>).body));
  return Boolean(text.description || text.summary || text.body || text.role || item.imageUrl || item.logoUrl || item.url || item.documentUrl || item.href || item.eventDate || body);
}
