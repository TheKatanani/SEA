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
