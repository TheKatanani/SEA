import { cohortSchema } from "@/lib/booking/domain";
export type CohortFormValues = {
  id: string; programCollection: string; programId: string; cohortCode: string; titleAr: string; titleEn: string;
  price: string; start: string; end: string; scheduleAr: string; scheduleEn: string; locationType: string;
  venueAr: string; venueEn: string; capacity: string; status: string; registrationOpen: boolean;
};
export type CohortFieldIssue = { path: Array<string | number>; message: string };
const formKeys: Record<string, string> = { priceMinor: "price", startAt: "start", endAt: "end" };
export function cohortFieldName(key: string, en: boolean) {
  return ({
    programId: en ? "Program / course" : "البرنامج / الدورة", cohortCode: en ? "Cohort code" : "رمز الدفعة",
    titleAr: en ? "Arabic cohort title" : "اسم الدفعة بالعربية", titleEn: en ? "English cohort title" : "اسم الدفعة بالإنجليزية",
    price: en ? "Fee" : "الرسوم", capacity: en ? "Capacity" : "السعة", start: en ? "Start date and time" : "موعد البداية",
    end: en ? "End date and time" : "موعد النهاية", scheduleAr: en ? "Arabic schedule" : "الجدول بالعربية",
    scheduleEn: en ? "English schedule" : "الجدول بالإنجليزية", venueAr: en ? "Arabic venue" : "الموقع بالعربية",
    venueEn: en ? "English venue" : "الموقع بالإنجليزية", locationType: en ? "Delivery mode" : "نمط التدريب",
  } as Record<string, string>)[key] || (en ? "Cohort details" : "بيانات الدفعة");
}
export function cohortFieldIssues(issues: CohortFieldIssue[], en: boolean): CohortFieldIssue[] {
  return issues.map(issue => {
    const key = formKeys[String(issue.path[0])] || String(issue.path[0]);
    const hint = key === "price" ? en ? "Enter a fee between 1 and 100,000 SAR." : "أدخل رسوماً بين 1 و100,000 ريال."
      : key === "capacity" ? en ? "Enter a whole number of seats between 1 and 500." : "أدخل عدداً صحيحاً للمقاعد بين 1 و500."
      : key === "start" ? en ? "Enter a valid start date and time." : "أدخل موعد بداية صالحاً."
      : key === "end" ? issue.message === "End must follow start" ? en ? "The end must be after the start." : "يجب أن تكون النهاية بعد البداية." : en ? "Enter a valid end date and time." : "أدخل موعد نهاية صالحاً."
      : key === "programId" ? en ? "Choose a published program or course." : "اختر برنامجاً أو دورة منشورة."
      : key === "cohortCode" ? en ? "Use 2–60 characters." : "استخدم بين حرفين و60 حرفاً."
      : key.startsWith("schedule") ? en ? "Enter 3–400 characters." : "أدخل نصاً بين 3 و400 حرف."
      : key.startsWith("venue") ? en ? "Enter 3–300 characters." : "أدخل نصاً بين 3 و300 حرف."
      : key.startsWith("title") ? en ? "Enter 3–200 characters." : "أدخل نصاً بين 3 و200 حرف."
      : en ? "Review this field." : "راجع هذا الحقل.";
    return { path: [key], message: cohortFieldName(key, en) + ": " + hint };
  });
}
function isoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return "";
  const date = new Date(value + (value.length === 16 ? ":00" : "") + "+03:00");
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
export function validateCohortForm(form: CohortFormValues, en: boolean, publish = false) {
  const result = cohortSchema.safeParse({
    ...(form.id ? { id: form.id } : {}), programCollection: form.programCollection, programId: form.programId,
    cohortCode: form.cohortCode, titleAr: form.titleAr, titleEn: form.titleEn,
    priceMinor: form.price.trim() ? Math.round(Number(form.price) * 100) : 0, currency: "SAR",
    startAt: isoDate(form.start), endAt: isoDate(form.end), timeZone: "Asia/Riyadh",
    scheduleAr: form.scheduleAr, scheduleEn: form.scheduleEn, locationType: form.locationType,
    venueAr: form.venueAr, venueEn: form.venueEn, capacity: form.capacity.trim() ? Number(form.capacity) : 0,
    status: publish ? "published" : "draft", registrationOpen: form.registrationOpen,
  });
  return result.success ? { data: result.data, issues: [] as CohortFieldIssue[] }
    : { data: undefined, issues: cohortFieldIssues(result.error.issues.map(issue => ({ path: issue.path as Array<string | number>, message: issue.message })), en) };
}
