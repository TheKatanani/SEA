"use client";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Cohort } from "@/lib/booking/domain";

export type PublicCohort = Omit<Cohort, "holds"> & { remaining: number; held: number; confirmed: number; open: boolean };
export function CohortOptions({ collection, programId, locale }: { collection: string; programId: string; locale: "ar" | "en" }) {
  const [items, setItems] = useState<PublicCohort[]>([]); const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [demo, setDemo] = useState(false);
  const en = locale === "en";
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/cohorts?" + new URLSearchParams({ collection, programId }), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const body = await response.json(); setItems(body.items); setEnabled(body.bookingEnabled); setDemo(body.demo === true); setState("ready");
      } catch { if (!controller.signal.aborted) setState("error"); }
    };
    void refresh(); const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [collection, programId]);
  return <section className="training-options page-shell" aria-labelledby={"cohorts-title-" + programId} id={"cohorts-" + programId} style={{ scrollMarginTop: "100px" }}>
    <div className="training-section-heading"><p className="eyebrow">{en ? "Book your place" : "احجز مقعدك"}</p><h2 id={"cohorts-title-" + programId}>{en ? "Dates, fees & available seats" : "المواعيد والرسوم والمقاعد المتاحة"}</h2><p>{en ? "Choose a cohort, enter one learner's details, then pay to confirm the seat." : "اختر الدفعة، أدخل بيانات متدرب واحد، ثم ادفع لتأكيد المقعد."}</p></div>
    <ol className="booking-steps" aria-label={en ? "Booking steps" : "خطوات الحجز"}>{(en ? ["Choose your cohort", "Enter learner details", "Pay & confirm"] : ["اختر الدفعة", "أدخل بيانات المتدرب", "ادفع وأكد الحجز"]).map((label, index) => <li key={label}><span aria-hidden="true">{index + 1}</span>{label}</li>)}</ol>
    {demo && <p className="training-demo-note" role="status">{en ? "Test bookings only — use fictional learner details and Moyasar test cards. No real course enrolment." : "حجوزات تجريبية فقط — استخدم بيانات وهمية وبطاقات ميسر الاختبارية. لا يمثل ذلك تسجيلاً فعلياً في دورة."}</p>}
    {state === "loading" && <p role="status">{en ? "Loading available cohorts…" : "جارٍ تحميل الدفعات…"}</p>}
    {state === "error" && <p className="training-alert" role="alert">{en ? "Availability could not be refreshed. Please try again shortly." : "تعذر تحديث المقاعد. يرجى المحاولة بعد قليل."}</p>}
    {state === "ready" && !items.length && <div className="training-empty"><h3>{en ? "New dates will be announced soon" : "سيُعلن عن الدفعات القادمة قريباً"}</h3><p>{en ? "Leave your interest and the Academy team will contact you." : "سجّل اهتمامك ليتمكن فريق الأكاديمية من التواصل معك."}</p><Link className="button button--primary" href="/apply">{en ? "Register interest" : "سجّل اهتمامك"}</Link></div>}
    {state === "ready" && items.length > 0 && !enabled && <p className="training-alert" role="status">{en ? "Online booking is temporarily unavailable. " : "الحجز الإلكتروني غير متاح حالياً. "}<Link href="/contact">{en ? "Contact the Academy" : "تواصل مع الأكاديمية"}</Link></p>}
    <div className="cohort-grid">{items.map((c) => <article className="cohort-card" key={c.id}>
      <div className="cohort-card__top"><span className={"seat-badge " + (!c.remaining ? "seat-badge--full" : "")} aria-live="polite">{!c.remaining ? en ? "Sold out" : "مكتملة المقاعد" : en ? c.remaining + " seats available" : "متبقي " + c.remaining + " مقاعد"}</span><small>{c.cohortCode}</small></div>
      <h3>{en ? c.titleEn : c.titleAr}</h3><strong className="cohort-price">{new Intl.NumberFormat(en ? "en-SA" : "ar-SA", { style: "currency", currency: "SAR" }).format(c.priceMinor / 100)}</strong>
      <dl className="training-facts"><div><dt>{en ? "Dates" : "الموعد"}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(new Date(c.startAt))} — {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(new Date(c.endAt))}</dd></div><div><dt>{en ? "Schedule" : "الجدول"}</dt><dd>{en ? c.scheduleEn : c.scheduleAr}</dd></div><div><dt>{en ? "Location" : "الموقع"}</dt><dd>{en ? c.venueEn : c.venueAr} · {c.locationType === "remote" ? en ? "Online" : "عن بُعد" : en ? "On campus" : "حضوري"}</dd></div></dl>
      <div className="seat-track" aria-hidden="true"><span style={{ width: ((c.capacity - c.remaining) / c.capacity * 100) + "%" }} /></div><p className="training-note">{en ? c.remaining + " of " + c.capacity + " seats available" : "متاح " + c.remaining + " من أصل " + c.capacity + " مقعداً"}</p>
      {c.open && enabled && state === "ready" ? <Link className="button button--primary" href={"/checkout/" + c.id}>{en ? "Book one seat" : "احجز مقعدك"}</Link> : <button className="button training-disabled" disabled>{!c.remaining ? en ? "Sold out" : "مكتملة المقاعد" : en ? "Booking currently unavailable" : "الحجز غير متاح حالياً"}</button>}
    </article>)}</div>
  </section>;
}

