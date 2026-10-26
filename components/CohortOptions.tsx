"use client";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Calendar, Clock, MapPin, Building2, Globe, ArrowLeft, ArrowRight } from "lucide-react";
import type { Cohort } from "@/lib/booking/domain";

export type PublicCohort = Omit<Cohort, "holds"> & { remaining: number; held: number; confirmed: number; open: boolean };

export function CohortOptions({ collection, programId, locale }: { collection: string; programId: string; locale: "ar" | "en" }) {
  const [items, setItems] = useState<PublicCohort[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [demo, setDemo] = useState(false);
  const en = locale === "en";

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/cohorts?" + new URLSearchParams({ collection, programId }), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const body = await response.json();
        setItems(body.items);
        setEnabled(body.bookingEnabled);
        setDemo(body.demo === true);
        setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [collection, programId]);

  return (
    <section className="training-options page-shell" aria-labelledby={"cohorts-title-" + programId} id={"cohorts-" + programId} style={{ scrollMarginTop: "100px" }}>
      <div className="training-section-heading">
        <h2 id={"cohorts-title-" + programId}>{en ? "Choose your cohort" : "اختر دفعتك"}</h2>
        <p>{en ? "Compare dates, fees and available seats, then continue to booking." : "اطّلع على المواعيد والرسوم والمقاعد المتاحة ثم تابع الحجز."}</p>
      </div>

      <ol className="booking-steps" aria-label={en ? "Booking steps" : "خطوات الحجز"}>
        {(en ? ["Choose cohort", "Learner details", "Pay & confirm"] : ["اختر الدفعة", "بيانات المتدرب", "ادفع وأكد المقعد"]).map((label, index) => (
          <li key={label}>
            <span aria-hidden="true">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {demo && (
        <p className="training-demo-note" role="status">
          {en
            ? "Test bookings only — use fictional learner details and Moyasar test cards. No real course enrolment."
            : "حجوزات تجريبية فقط — استخدم بيانات وهمية وبطاقات ميسر الاختبارية. لا يمثل ذلك تسجيلاً فعلياً في دورة."}
        </p>
      )}

      {state === "loading" && <p role="status">{en ? "Loading available cohorts…" : "جارٍ تحميل الدفعات المتاحة…"}</p>}
      {state === "error" && <p className="training-alert" role="alert">{en ? "Availability could not be refreshed. Please try again shortly." : "تعذر تحديث المقاعد. يرجى المحاولة بعد قليل."}</p>}

      {state === "ready" && !items.length && (
        <div className="training-empty">
          <h3>{en ? "New dates will be announced soon" : "سيُعلن عن الدفعات القادمة قريباً"}</h3>
          <p>{en ? "Leave your interest and the Academy team will contact you." : "سجّل اهتمامك ليتمكن فريق الأكاديمية من التواصل معك فور فتح الدفعات."}</p>
          <Link className="button button--primary" href="/apply">
            {en ? "Register interest" : "سجّل اهتمامك"}
          </Link>
        </div>
      )}

      {state === "ready" && items.length > 0 && !enabled && (
        <p className="training-alert" role="status">
          {en ? "Online booking is temporarily unavailable. " : "الحجز الإلكتروني غير متاح حالياً. "}
          <Link href="/contact">{en ? "Contact the Academy" : "تواصل مع الأكاديمية"}</Link>
        </p>
      )}

      <div className="cohort-grid">
        {items.map((c) => {
          return (
            <article className="cohort-card" key={c.id}>
              <div className="cohort-card__top">
                <span className={"seat-badge " + (!c.remaining ? "seat-badge--full" : "")} aria-live="polite">
                  <span className="seat-badge__dot" />
                  {!c.remaining ? (en ? "Sold out" : "مكتملة المقاعد") : en ? `${c.remaining} seats available` : `متبقي ${c.remaining} مقاعد`}
                </span>
                <span className="mode-badge">
                  {c.locationType === "remote" ? <Globe size={13} /> : <Building2 size={13} />}
                  {c.locationType === "remote" ? (en ? "Online" : "عن بُعد") : en ? "On campus" : "حضوري"}
                </span>
                <span className="cohort-code-badge">{c.cohortCode}</span>
              </div>

              <h3>{en ? c.titleEn : c.titleAr}</h3>

              <div className="cohort-price-wrap">
                <strong className="cohort-price">
                  {new Intl.NumberFormat(en ? "en-SA" : "ar-SA", { style: "currency", currency: "SAR" }).format(c.priceMinor / 100)}
                </strong>
                <span className="cohort-price-vat">{en ? "Inclusive fee" : "رسوم نهائية"}</span>
              </div>

              <dl className="training-facts">
                <div>
                  <Calendar size={15} className="training-facts__icon" />
                  <dt>{en ? "Dates" : "الموعد"}</dt>
                  <dd>
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(new Date(c.startAt))} —{" "}
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(new Date(c.endAt))}
                  </dd>
                </div>
                <div>
                  <Clock size={15} className="training-facts__icon" />
                  <dt>{en ? "Schedule" : "الجدول"}</dt>
                  <dd>{en ? c.scheduleEn : c.scheduleAr}</dd>
                </div>
                <div>
                  <MapPin size={15} className="training-facts__icon" />
                  <dt>{en ? "Location" : "المقر"}</dt>
                  <dd>{en ? c.venueEn : c.venueAr}</dd>
                </div>
              </dl>

              {c.open && enabled && state === "ready" ? (
                <Link className="button button--primary" href={"/checkout/" + c.id}>
                  {en ? "Book one seat" : "احجز مقعداً واحداً"}
                  {en ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                </Link>
              ) : (
                <button className="button training-disabled" disabled>
                  {!c.remaining ? (en ? "Sold out" : "مكتملة المقاعد") : en ? "Booking currently unavailable" : "الحجز غير متاح حالياً"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
