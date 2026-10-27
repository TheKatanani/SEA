import { z } from "zod";
import type { CohortFormValues } from "./cohort-form";
import { textHash } from "./content";

export const cohortAiKeys = ["titleAr", "titleEn", "price", "capacity", "start", "end", "scheduleAr", "scheduleEn", "venueAr", "venueEn"] as const;
export type CohortAiKey = typeof cohortAiKeys[number];
export const cohortBriefSchema = z.object({ brief: z.string().trim().min(10).max(8000) }).strict();
export const cohortSuggestionsSchema = z.object({ fields: z.array(z.object({ key: z.enum(cohortAiKeys), text: z.string().trim().min(1).max(400), evidence: z.string().trim().min(1).max(2000) }).strict()).max(10) }).strict();
export type CohortAiSuggestion = z.infer<typeof cohortSuggestionsSchema>["fields"][number];
export const normalizeDigits = (text: string) => text.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/٫/g, ".").replace(/[٬,](?=\d{3}(?:\D|$))/g, "");

function explicitDateTime(source: string) {
  const months = ["january|يناير|كانون الثاني", "february|فبراير|شباط", "march|مارس|آذار", "april|أبريل|ابريل|نيسان", "may|مايو|أيار", "june|يونيو|حزيران", "july|يوليو|تموز", "august|أغسطس|اغسطس|آب", "september|سبتمبر|أيلول", "october|أكتوبر|اكتوبر|تشرين الأول", "november|نوفمبر|تشرين الثاني", "december|ديسمبر|كانون الأول"];
  const iso = source.match(/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/);
  let date = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : undefined;
  if (!date) for (let index = 0; index < months.length; index++) {
    const dayFirst = source.match(new RegExp("(\\d{1,2})\\s+(?:" + months[index] + ")\\s*,?\\s*(\\d{4})", "i"));
    const monthFirst = source.match(new RegExp("(?:" + months[index] + ")\\s+(\\d{1,2})\\s*,?\\s*(\\d{4})", "i"));
    const match = dayFirst || monthFirst;
    if (match) { date = [Number(match[2]), index + 1, Number(match[1])]; break; }
  }
  if (!date) { const numeric = source.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/); if (numeric && Number(numeric[1]) > 12) date = [Number(numeric[3]), Number(numeric[2]), Number(numeric[1])]; }
  const time = source.match(/\b(\d{1,2}):(\d{2})(?:\s*(am|pm|صباحاً|صباحا|صباحًا|مساءً|مساء|مساءا|مساءً))?/i);
  if (!date || !time) return null;
  let hour = Number(time[1]); const minute = Number(time[2]), period = time[3];
  if (period) { if (hour < 1 || hour > 12) return null; hour = hour % 12 + (/pm|مساء/i.test(period) ? 12 : 0); }
  if (hour > 23 || minute > 59) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const value = `${date[0]}-${pad(date[1])}-${pad(date[2])}T${pad(hour)}:${pad(minute)}`;
  const parsed = new Date(value + ":00+03:00");
  return Number.isFinite(parsed.getTime()) && new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 16) === value ? value : null;
}

// Numeric and operational values must be copied from an explicit, quoted fact.
// Ambiguous dates remain empty rather than converting a guess into a bookable event.
export function validateCohortSuggestions(brief: string, raw: unknown) {
  const output = cohortSuggestionsSchema.parse(raw);
  if (new Set(output.fields.map(f => f.key)).size !== output.fields.length) throw new Error("Duplicate field");
  const fields = output.fields.filter(field => {
    if (!brief.includes(field.evidence)) throw new Error("Evidence is not in the source");
    const source = normalizeDigits(field.evidence), value = normalizeDigits(field.text);
    const numbers = (s: string): string[] => s.match(/\d+(?:\.\d+)?/g) || [];
    if (!["start", "end"].includes(field.key) && numbers(value).some(n => !numbers(source).some(original => Number(original) === Number(n)))) throw new Error("Unsupported numeric fact");
    const urls = value.match(/https?:\/\/[^\s]+/g) || [];
    if (urls.some(url => !field.evidence.includes(url))) throw new Error("Unsupported link");
    if (field.key === "price" || field.key === "capacity") {
      const number = Number(value);
      const label = field.key === "price" ? /SAR|ريال|رسوم|سعر|ر\.س|﷼|fee|price/i : /مقعد|مقاعد|سعة|seat|capacity/i;
      if (!label.test(source) || !/^\d+(\.\d{1,2})?$/.test(value) || number < 1 || number > (field.key === "price" ? 100000 : 500) || field.key === "capacity" && !Number.isInteger(number)) return false;
      field.text = value;
    } else if (field.key === "start" || field.key === "end") {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
      const label = field.key === "start" ? /بداية|تبدأ|بدء|start|from/i : /نهاية|تنتهي|انتهاء|end|until|to\b/i;
      if (!label.test(source) || explicitDateTime(source) !== value) return false;
      field.text = value;
    } else if (field.text.length > (field.key.startsWith("title") ? 200 : field.key.startsWith("venue") ? 300 : 400)) return false;
    return true;
  });
  return { fields, sourceHash: textHash(brief) };
}

export function applyCohortSuggestions(form: CohortFormValues, baseline: CohortFormValues, fields: CohortAiSuggestion[], selected: string[]) {
  const next = { ...form };
  for (const field of fields) {
    // Changing the record, source or a target during a request must not overwrite manual work.
    if (cohortAiKeys.includes(field.key) && selected.includes(field.key) && !String(form[field.key]).trim() && form[field.key] === baseline[field.key]) next[field.key] = field.text;
  }
  return next;
}
