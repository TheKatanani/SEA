import { z } from "zod";
import { availability, type Cohort } from "@/lib/booking/domain";
export const reportNames = ["missing_upcoming", "nearly_full", "draft_cohorts", "registration_closed"] as const;
export const insightRequestSchema = z.union([
  z.object({ question: z.string().trim().min(3).max(500) }).strict(),
  z.object({ report: z.enum(reportNames) }).strict(),
]);
export const intentSchema = z.object({ report: z.enum([...reportNames, "unsupported"]) }).strict();
export const reportLabels = {
  missing_upcoming: { ar: "دورات بلا دفعات قادمة متاحة للحجز", en: "Courses without upcoming bookable cohorts" },
  nearly_full: { ar: "دفعات قريبة من اكتمال المقاعد", en: "Cohorts with 20% or fewer seats left" },
  draft_cohorts: { ar: "دفعات بانتظار النشر", en: "Draft cohorts" },
  registration_closed: { ar: "دفعات قادمة والتسجيل مغلق", en: "Upcoming cohorts with registration closed" },
};
type RecordRow = Record<string, any> & { id: string; collection?: string };
export function buildInsight(report: typeof reportNames[number], cohorts: RecordRow[], courses: RecordRow[], now = Date.now()) {
  const rows = report === "missing_upcoming" ? courses.filter(course => course.status === "published" && !cohorts.some(cohort => cohort.programId === course.id && cohort.programCollection === course.collection && availability(cohort as Cohort, now).open))
    : cohorts.filter(cohort => {
      const upcoming = Date.parse(cohort.startAt) > now;
      if (report === "draft_cohorts") return cohort.status === "draft";
      if (report === "registration_closed") return upcoming && cohort.status === "published" && !cohort.registrationOpen;
      const seats = availability(cohort as Cohort, now);
      return upcoming && cohort.status === "published" && cohort.registrationOpen && cohort.capacity > 0 && seats.remaining / cohort.capacity <= 0.2;
    });
  const results = rows.map(row => {
    const seats = report === "missing_upcoming" ? null : availability(row as Cohort, now);
    return { id: row.id, collection: report === "missing_upcoming" ? row.collection! : "cohorts", titleAr: String(row.titleAr || row.locales?.ar?.title || row.locales?.en?.title || "بلا عنوان"), titleEn: String(row.titleEn || row.locales?.en?.title || row.locales?.ar?.title || "Untitled"), status: String(row.status || ""), remaining: seats?.remaining ?? null, capacity: seats?.capacity ?? null };
  }).sort((a, b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id));
  return { report, total: results.length, rows: results.slice(0, 100), limited: results.length > 100, checkedAt: new Date(now).toISOString() };
}
