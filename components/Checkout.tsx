"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PublicCohort } from "./CohortOptions";
type BookingView = { id: string; bookingNumber: string; status: string; amountMinor: number; currency: string; holdExpiresAt: number; fullName: string; confirmedAt?: number };
type BookingResult = { booking: BookingView; cohort: PublicCohort; checkoutReference: string };
declare global { interface Window { Moyasar?: { init(options: Record<string, unknown>): void } } }
const labels: Record<string, [string, string]> = {
  REGISTRATION_CLOSED: ["اكتملت المقاعد أو أغلق التسجيل. اختر دفعة أخرى.", "Registration has closed. Please choose another cohort."],
  INVALID_BOOKING_DETAILS: ["راجع الاسم الرباعي والهوية والجوال والبريد.", "Please check your full name, ID, mobile and email."],
  TOO_MANY_REQUESTS: ["محاولات كثيرة. يرجى المحاولة لاحقاً.", "Too many attempts. Please try again later."],
  BOOKING_ACCESS_DENIED: ["تعذر التحقق من رابط الحجز. افتح الرابط الأصلي.", "This booking link could not be verified. Please use the original link."],
};
function errorLabel(code: string, en: boolean) { return labels[code]?.[en ? 1 : 0] || (en ? "The service is temporarily unavailable. Please contact the Academy." : "الخدمة غير متاحة مؤقتاً. يرجى التواصل مع الأكاديمية."); }

function PaymentForm({ data, token, locale }: { data: BookingResult; token: string; locale: string }) {
  const [ready, setReady] = useState(false); const [error, setError] = useState(false); const mounted = useRef(false);
  const paymentElement = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now()); const en = locale === "en"; const b = data.booking;
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, []);
  const remaining = Math.max(0, Math.ceil((b.holdExpiresAt - now) / 1000));
  useEffect(() => {
    if (!ready || !window.Moyasar || !paymentElement.current || mounted.current || b.status !== "PENDING" || remaining === 0) return;
    mounted.current = true;
    const prefix = en ? "/en" : "";
    // The SDK replaces the element's id; retaining the DOM element keeps its later lookups valid.
    try { window.Moyasar.init({ element: paymentElement.current, amount: b.amountMinor, currency: b.currency, language: locale, fixed_width: false,
      description: "SEA " + b.bookingNumber, publishable_api_key: process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY,
      callback_url: window.location.origin + prefix + "/booking/callback?booking=" + b.id,
      metadata: { booking_id: b.id, checkout_reference: data.checkoutReference },
      methods: process.env.NEXT_PUBLIC_MOYASAR_APPLE_PAY_ENABLED === "true" ? ["creditcard", "applepay"] : ["creditcard"],
      supported_networks: ["mada", "visa", "mastercard"],
      apple_pay: { country: "SA", label: "Saudi Entertainment Academy", validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate" },
      on_completed: async (payment: { id: string }) => {
        sessionStorage.setItem("sea-payment-" + b.id, payment.id);
        const response = await fetch("/api/bookings/" + b.id, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: payment.id }), cache: "no-store" });
        if (!response.ok) throw new Error("Verification unavailable");
      },
    }); } catch { setError(true); }
  }, [ready, b, data.checkoutReference, en, locale, token, remaining]);
  if (remaining === 0 || b.status !== "PENDING") return <div className="training-alert"><h3>{en ? "The reservation has expired" : "انتهت مهلة الحجز"}</h3><p>{en ? "Choose an available seat again. A late payment will be reviewed by the Academy." : "اختر مقعداً متاحاً من جديد. أي دفع متأخر ستراجعه الأكاديمية."}</p><Link href="/programs" className="button button--primary">{en ? "Programs" : "البرامج"}</Link></div>;
  return <div className="payment-panel"><div className="hold-clock" role="timer">{en ? "Seat held for" : "مقعدك محفوظ لمدة"} <strong dir="ltr">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong></div><h2>{en ? "Complete your payment" : "أكمل الدفع"}</h2><p>{en ? "Booking" : "رقم الحجز"}: <b dir="ltr">{b.bookingNumber}</b></p>
    <link rel="stylesheet" href="https://cdn.moyasar.com/mpf/1.15.0/moyasar.css" />
    <Script src="https://cdn.moyasar.com/mpf/1.15.0/moyasar.js" onReady={() => setReady(true)} onError={() => setError(true)} />
    {error && <p role="alert">{en ? "Payment form could not be loaded. Please refresh." : "تعذر تحميل نموذج الدفع. يرجى تحديث الصفحة."}</p>}
    <div ref={paymentElement} className="sea-payment" />
    <Link className="text-link" href={"/booking/confirmation/" + b.id + "#token=" + token}>{en ? "Check booking status" : "متابعة حالة الحجز"}</Link>
  </div>;
}
export function Checkout({ cohort, enabled, demo = false }: { cohort: PublicCohort; enabled: boolean; demo?: boolean }) {
  const locale = useLocale(); const en = locale === "en"; const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [result, setResult] = useState<BookingResult | null>(null); const [token, setToken] = useState("");
  useEffect(() => {
    const saved = sessionStorage.getItem("sea-active-" + cohort.id);
    if (!saved) return;
    const id = saved; const access = sessionStorage.getItem("sea-booking-" + id);
    if (!access) return;
    fetch("/api/bookings/" + id, { headers: { Authorization: "Bearer " + access }, cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((v) => { if (v?.booking?.status === "PENDING" && v.booking.holdExpiresAt > Date.now()) { setResult(v); setToken(access); } else if (v?.booking?.status === "EXPIRED" || v?.booking?.status === "CANCELLED") { sessionStorage.removeItem("sea-request-" + cohort.id); sessionStorage.removeItem("sea-active-" + cohort.id); } }).catch(() => {});
  }, [cohort.id]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const values = new FormData(event.currentTarget); const keyName = "sea-request-" + cohort.id;
      let requestKey = sessionStorage.getItem(keyName); if (!requestKey) { requestKey = crypto.randomUUID(); sessionStorage.setItem(keyName, requestKey); }
      const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cohortId: cohort.id, requestKey, locale, privacyConsent: values.get("consent") === "on", attendee: Object.fromEntries(["fullName", "nationalId", "mobile", "email"].map((name) => [name, values.get(name)])) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      if (body.status !== "PENDING") { sessionStorage.removeItem(keyName); throw new Error("REGISTRATION_CLOSED"); }
      sessionStorage.setItem("sea-booking-" + body.id, body.accessToken); sessionStorage.setItem("sea-active-" + cohort.id, body.id);
      const details = await fetch("/api/bookings/" + body.id, { headers: { Authorization: "Bearer " + body.accessToken }, cache: "no-store" });
      if (!details.ok) throw new Error("SERVICE_UNAVAILABLE");
      setToken(body.accessToken); setResult(await details.json());
    } catch (caught) { setError(errorLabel(caught instanceof Error ? caught.message : "", en)); }
    finally { setBusy(false); }
  }
  return <div className="checkout-shell page-shell"><div className="training-section-heading"><p className="eyebrow">SEA · {en ? "Single-seat booking" : "حجز مقعد واحد"}</p><h1>{en ? "Your place in the next cohort" : "مقعدك في الدفعة القادمة"}</h1><p>{en ? "Enter the learner's details, then complete your payment." : "أدخل بيانات المتدرب ثم أكمل الدفع لتأكيد مقعدك."}</p></div>{demo && <p className="training-demo-note" role="status">{en ? "Test environment — fictional learner details and Moyasar test cards only. This is not a real course enrolment." : "بيئة تجريبية — استخدم بيانات متدرب وهمية وبطاقات ميسر الاختبارية فقط. هذا ليس تسجيلاً فعلياً في دورة."}</p>}<div className="checkout-grid"><section className="content-panel">
    {result ? <PaymentForm data={result} token={token} locale={locale} /> : !enabled || !cohort.open ? <div className="training-empty"><h2>{en ? "Booking currently unavailable" : "الحجز غير متاح حالياً"}</h2><p>{en ? "Please contact the Academy or choose another cohort." : "يرجى التواصل مع الأكاديمية أو اختيار دفعة أخرى."}</p><Link href="/contact" className="button button--primary">{en ? "Contact us" : "تواصل معنا"}</Link></div> : <form className="training-form" onSubmit={submit}><h2>{en ? "Learner details" : "بيانات المتدرب"}</h2><p className="training-note">{en ? "This booking is for one learner and one seat only." : "هذا الحجز لمتدرب واحد ومقعد واحد فقط."}</p>
      <label>{en ? "Full name" : "الاسم الرباعي"}<input name="fullName" autoComplete="name" minLength={6} maxLength={150} required /></label>
      <label>{en ? "National ID / Iqama" : "رقم الهوية / الإقامة"}<input name="nationalId" inputMode="numeric" pattern="[12][0-9]{9}" minLength={10} maxLength={10} required /></label>
      <label>{en ? "Mobile" : "الجوال"}<input name="mobile" type="tel" autoComplete="tel" minLength={9} maxLength={20} required /></label>
      <label>{en ? "Email" : "البريد الإلكتروني"}<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label className="training-consent"><input name="consent" type="checkbox" required /><span>{en ? "I agree to the processing of my details for this booking and the " : "أوافق على معالجة بياناتي لإتمام الحجز وفق "}<Link href="/policies/privacy">{en ? "privacy policy" : "سياسة الخصوصية"}</Link>.</span></label>
      <button className="button button--primary" disabled={busy}>{busy ? en ? "Reserving…" : "جارٍ حفظ المقعد…" : en ? "Reserve one seat & pay" : "احفظ مقعداً وانتقل للدفع"}</button>{error && <p className="training-alert" role="alert">{error}</p>}
    </form>}
    </section><aside className="cohort-card checkout-summary"><span className="seat-badge">{en ? "1 learner · 1 seat" : "متدرب واحد · مقعد واحد"}</span><h2>{en ? cohort.titleEn : cohort.titleAr}</h2><p>{cohort.cohortCode}</p><strong className="cohort-price">{new Intl.NumberFormat(locale, { style: "currency", currency: "SAR" }).format(cohort.priceMinor / 100)}</strong><dl className="training-facts"><div><dt>{en ? "Dates" : "الموعد"}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Asia/Riyadh" }).format(new Date(cohort.startAt))}</dd></div><div><dt>{en ? "Schedule" : "الجدول"}</dt><dd>{en ? cohort.scheduleEn : cohort.scheduleAr}</dd></div><div><dt>{en ? "Location" : "الموقع"}</dt><dd>{en ? cohort.venueEn : cohort.venueAr}</dd></div></dl><p className="training-note">{en ? "Your seat is confirmed only after successful payment verification." : "يُؤكد مقعدك بعد التحقق من نجاح الدفع."}</p></aside></div></div>;
}
export function BookingReceipt({ bookingId, callback = false }: { bookingId?: string; callback?: boolean }) {
  const en = useLocale() === "en"; const [data, setData] = useState<BookingResult | null>(null); const [error, setError] = useState(""); const [token, setToken] = useState(""); const [id, setId] = useState(bookingId || "");
  useEffect(() => {
    const search = new URLSearchParams(window.location.search); const booking = bookingId || search.get("booking") || "";
    const access = new URLSearchParams(window.location.hash.slice(1)).get("token") || sessionStorage.getItem("sea-booking-" + booking) || "";
    setId(booking); setToken(access);
    if (!booking || !access) { setError(errorLabel("BOOKING_ACCESS_DENIED", en)); return; }
    sessionStorage.setItem("sea-booking-" + booking, access);
    let disposed = false; let verify = callback ? search.get("id") || sessionStorage.getItem("sea-payment-" + booking) : null;
    const refresh = async () => {
      try {
        if (verify) { const verified = await fetch("/api/bookings/" + encodeURIComponent(booking), { method: "POST", headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: verify }) }); if (!verified.ok) throw new Error("SERVICE_UNAVAILABLE"); verify = null; }
        const response = await fetch("/api/bookings/" + encodeURIComponent(booking), { headers: { Authorization: "Bearer " + access }, cache: "no-store" });
        const body = await response.json(); if (!response.ok) throw new Error(body.error);
        verify = null; if (!disposed) { setData(body); setError(""); if (body.booking?.status !== "PENDING") clearInterval(timer); }
      } catch (caught) { if (!disposed) setError(errorLabel(caught instanceof Error ? caught.message : "", en)); }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 5000);
    return () => { disposed = true; clearInterval(timer); };
  }, [bookingId, callback, en]);
  const b = data?.booking;
  const states: Record<string, [string, string]> = { PENDING: ["بانتظار اكتمال الدفع", "Awaiting payment"], CONFIRMED: ["تم تأكيد مقعدك", "Your seat is confirmed"], EXPIRED: ["انتهت مهلة الحجز", "Reservation expired"], REFUND_PENDING: ["دفعة تحتاج مراجعة واسترجاع", "Payment awaiting review / refund"], REFUNDED: ["تم استرجاع الدفعة", "Payment refunded"], CANCELLED: ["أُلغي الحجز", "Booking cancelled"] };
  return <div className="booking-receipt page-shell"><div className="content-panel"><p className="eyebrow">SEA · {en ? "Booking status" : "حالة الحجز"}</p><h1 aria-live="polite">{b ? states[b.status]?.[en ? 1 : 0] || b.status : en ? "Checking your booking…" : "جارٍ التحقق من الحجز…"}</h1>{error && <p className="training-alert" role="alert">{error}</p>}{b && data && <><p className="receipt-number" dir="ltr">{b.bookingNumber}</p><h2>{b.fullName}</h2><p>{en ? data.cohort.titleEn : data.cohort.titleAr}</p><dl className="training-facts"><div><dt>{en ? "Amount" : "المبلغ"}</dt><dd>{new Intl.NumberFormat(en ? "en-SA" : "ar-SA", { style: "currency", currency: b.currency }).format(b.amountMinor / 100)}</dd></div><div><dt>{en ? "Starts" : "بداية البرنامج"}</dt><dd>{new Intl.DateTimeFormat(en ? "en" : "ar", { dateStyle: "long", timeZone: "Asia/Riyadh" }).format(new Date(data.cohort.startAt))}</dd></div><div><dt>{en ? "Location" : "الموقع"}</dt><dd>{en ? data.cohort.venueEn : data.cohort.venueAr}</dd></div><div><dt>{en ? "Schedule" : "الجدول"}</dt><dd>{en ? data.cohort.scheduleEn : data.cohort.scheduleAr}</dd></div></dl>{b.status === "CONFIRMED" && <button className="button button--primary no-print" onClick={() => window.print()}>{en ? "Print receipt" : "طباعة الإيصال"}</button>}{b.status === "PENDING" && <Link className="button button--primary" href={"/checkout/" + data.cohort.id}>{en ? "Continue payment" : "متابعة الدفع"}</Link>}{callback && <Link className="text-link" href={"/booking/confirmation/" + id + "#token=" + token}>{en ? "Keep this booking link" : "احتفظ برابط حجزك"}</Link>}</>}<Link className="text-link no-print" href="/programs">{en ? "Back to programs" : "العودة للبرامج"}</Link></div></div>;
}

