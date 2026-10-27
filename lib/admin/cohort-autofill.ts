import { getPath, type ContentRecord } from "./content";

type Program = ContentRecord & { id: string; collection: string };
type Cohort = ContentRecord & { id?: string };
export function cohortSuggestion(program: Program, cohorts: Cohort[], current?: { id: string; cohortCode: string }) {
  const unique = [...new Map(cohorts.map(cohort => [cohort.id || String(cohort.cohortCode), cohort])).values()];
  const prefix = program.id.replace(/^(course|program)-/, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "SEA";
  const related = unique.filter(cohort => cohort.programCollection === program.collection && cohort.programId === program.id);
  const taken = new Set(unique.map(cohort => String(cohort.cohortCode || "").trim().toUpperCase()));
  let highest = related.length;
  for (const code of taken) {
    const match = code.match(new RegExp("^" + prefix + "-(\\d+)$"));
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  let number = highest + 1;
  let code = prefix + "-" + String(number).padStart(2, "0");
  while (taken.has(code)) { number++; code = prefix + "-" + String(number).padStart(2, "0"); }
  if (current?.id) { code = current.cohortCode; number = Number(code.match(/(\d+)$/)?.[1]) || Math.max(1, related.length); }
  const ordinals = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة", "الحادية عشرة", "الثانية عشرة"];
  const titleAr = String(getPath(program, "locales.ar.title") || program.title || getPath(program, "locales.en.title") || "").trim();
  const titleEn = String(getPath(program, "locales.en.title") || program.title || titleAr).trim();
  if (!titleAr && !titleEn) return null;
  return {
    programCollection: program.collection, programId: program.id, cohortCode: code,
    titleAr: "الدفعة " + (ordinals[number - 1] || "رقم " + number) + " - " + titleAr,
    titleEn: "Cohort " + number + " - " + titleEn,
  };
}

export const cohortAutofillFields = ["cohortCode", "titleAr", "titleEn", "price", "capacity", "start", "end", "scheduleAr", "scheduleEn", "venueAr", "venueEn"] as const;
type FormValues = import("./cohort-form").CohortFormValues;
const savedText = (value: unknown, max: number) => typeof value === "string" && value.trim().length >= 3 && value.trim().length <= max ? value.trim() : "";
const dateMs = (value: unknown) => typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : 0;
const riyadhDate = (value: unknown) => new Date(dateMs(value) + 3 * 3600000).toISOString().slice(0, 16);
export function cohortAutofill(program: Program, cohorts: Cohort[], current: FormValues, now = Date.now(), deliveryEdited = false) {
  const names = cohortSuggestion(program, cohorts, current);
  if (!names) return null;
  const related = [...new Map(cohorts.map(cohort => [cohort.id, cohort])).values()]
    .filter(cohort => cohort.id !== current.id && cohort.programCollection === program.collection && cohort.programId === program.id)
    .sort((a,b) => (dateMs(b.updatedAt) || dateMs(b.createdAt) || dateMs(b.startAt)) - (dateMs(a.updatedAt) || dateMs(a.createdAt) || dateMs(a.startAt)));
  const previous = related[0];
  const patch: Partial<FormValues> = {};
  function fill(key: keyof FormValues, value: string) { if (!String(current[key] ?? "").trim() && value) Object.assign(patch, { [key]: value }); }
  fill("cohortCode", names.cohortCode); fill("titleAr", names.titleAr); fill("titleEn", names.titleEn);
  const fee = typeof program.price === "number" ? program.price : typeof program.price === "string" && /^\d+(\.\d{1,2})?$/.test(program.price.trim()) ? Number(program.price) : Number(previous?.priceMinor) / 100;
  if (Number.isFinite(fee) && fee >= 1 && fee <= 100000) fill("price", String(fee));
  const capacity = typeof program.capacity === "number" ? program.capacity : previous?.capacity;
  if (typeof capacity === "number" && Number.isInteger(capacity) && capacity >= 1 && capacity <= 500) fill("capacity", String(capacity));
  for (const locale of ["ar", "en"] as const) {
    const suffix = locale === "ar" ? "Ar" : "En";
    fill(("schedule" + suffix) as keyof FormValues, savedText(getPath(program, "locales." + locale + ".hoursAndSchedule"), 400) || savedText(previous?.["schedule" + suffix], 400));
    fill(("venue" + suffix) as keyof FormValues, savedText(getPath(program, "locales." + locale + ".location"), 300) || savedText(previous?.["venue" + suffix], 300) || savedText(program.location, 300));
  }
  const courseLocation = program.location || getPath(program, "locales.ar.location") || getPath(program, "locales.en.location");
  if (!deliveryEdited && !current.id && !current.venueAr.trim() && !current.venueEn.trim()) {
    if (["in_person", "remote"].includes(String(program.locationType))) patch.locationType = String(program.locationType);
    else if (!courseLocation && ["in_person", "remote"].includes(String(previous?.locationType))) patch.locationType = String(previous!.locationType);
  }
  // Reuse exact future dates only; past sessions do not define a new session's dates.
  const explicitDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  const courseDates = explicitDate(program.startDate) && explicitDate(program.endDate);
  const start = courseDates ? program.startDate : previous?.startAt, end = courseDates ? program.endDate : previous?.endAt;
  if (!current.start && !current.end && dateMs(start) > now && dateMs(end) > dateMs(start)) {
    patch.start = riyadhDate(start); patch.end = riyadhDate(end);
  }
  const next = { ...current, ...patch };
  return { patch, filled: Object.keys(patch), missing: cohortAutofillFields.filter(key => !String(next[key]).trim()), sourceCohortId: previous?.id || null };
}
