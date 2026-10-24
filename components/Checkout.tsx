"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShieldCheck, Printer, CheckCircle2, Clock, AlertCircle, ArrowLeft, ArrowRight, Building2, Calendar, FileSpreadsheet, Lock } from "lucide-react";
import type { PublicCohort } from "./CohortOptions";

type BookingView = { id: string; bookingNumber: string; status: string; amountMinor: number; currency: string; holdExpiresAt: number; fullName: string; confirmedAt?: number };
type BookingResult = { booking: BookingView; cohort: PublicCohort; checkoutReference: string };
declare global { interface Window { Moyasar?: { init(options: Record<string, unknown>): void } } }

const labels: Record<string, [string, string]> = {
  REGISTRATION_CLOSED: ["اكتملت المقاعد أو أغلق التسجيل. اختر دفعة أخرى.", "Registration has closed. Please choose another cohort."],
  INVALID_BOOKING_DETAILS: ["راجع الاسم الرباعي والهوية والجوال والبريد.", "Please check your full name, ID, mobile and email."],
  TOO_MANY_REQUESTS: ["محاولات كثيرة. يرجى المحاولة لاحقاً.", "Too many attempts. Please try again later."],
  BOOKING_ACCESS_DENIED: ["تعذر التحقق من رابط الحجز. افتح الرابط الأصلي.", "This booking link could not be verified. Please use the original link."],
  ALREADY_REGISTERED: ["أنت مسجل بالفعل في هذه الدفعة برقم الهوية المدخل.", "You are already registered in this cohort with this National ID."],
};

function errorLabel(code: string, en: boolean) {
  return labels[code]?.[en ? 1 : 0] || (en ? "The service is temporarily unavailable. Please contact the Academy." : "الخدمة غير متاحة مؤقتاً. يرجى التواصل مع الأكاديمية.");
}

function PaymentForm({ data, token, locale }: { data: BookingResult; token: string; locale: string }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(false);
  const paymentElement = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());
  const en = locale === "en";
  const b = data.booking;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = Math.max(0, Math.ceil((b.holdExpiresAt - now) / 1000));

  useEffect(() => {
    if (!ready || !window.Moyasar || !paymentElement.current || mounted.current || b.status !== "PENDING" || remaining === 0) return;
    mounted.current = true;
    const prefix = en ? "/en" : "";
    try {
      window.Moyasar.init({
        element: paymentElement.current,
        amount: b.amountMinor,
        currency: b.currency,
        language: locale,
        fixed_width: false,
        description: "SEA " + b.bookingNumber,
        publishable_api_key: process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY,
        callback_url: window.location.origin + prefix + "/booking/callback?booking=" + b.id,
        metadata: { booking_id: b.id, checkout_reference: data.checkoutReference },
        methods: process.env.NEXT_PUBLIC_MOYASAR_APPLE_PAY_ENABLED === "true" ? ["creditcard", "applepay"] : ["creditcard"],
        supported_networks: ["mada", "visa", "mastercard"],
        apple_pay: { country: "SA", label: "Saudi Entertainment Academy", validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate" },
        on_completed: async (payment: { id: string }) => {
          sessionStorage.setItem("sea-payment-" + b.id, payment.id);
          const response = await fetch("/api/bookings/" + b.id, {
            method: "POST",
            headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: payment.id }),
            cache: "no-store",
          });
          if (!response.ok) throw new Error("Verification unavailable");
        },
      });
    } catch {
      setError(true);
    }
  }, [ready, b, data.checkoutReference, en, locale, token, remaining]);

  if (remaining === 0 || b.status !== "PENDING") {
    return (
      <div className="training-alert training-alert--warning" role="alert">
        <Clock size={24} className="training-alert__icon" aria-hidden="true" />
        <div className="training-alert__content">
          <h3>{en ? "The reservation has expired" : "انتهت مهلة الحجز المؤقت"}</h3>
          <p>{en ? "Choose an available seat again. A late payment will be reviewed by the Academy." : "اختر مقعداً متاحاً من جديد. أي دفع متأخر ستراجعه الأكاديمية."}</p>
          <div style={{ marginTop: "10px" }}>
            <Link href="/programs" className="button button--primary">
              {en ? "Browse Programs" : "استعراض البرامج"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-panel">
      <div className="hold-clock" role="timer">
        <div className="hold-clock__info">
          <ShieldCheck size={22} />
          <span>{en ? "Seat held & protected for" : "مقعدك محجوز ومحمي مؤقتاً لمدة"}</span>
        </div>
        <strong dir="ltr">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </strong>
      </div>
      <h2>{en ? "Complete your payment" : "أدخل بيانات الدفع لتأكيد الحجز"}</h2>
      <p style={{ margin: "0", color: "#64748b" }}>
        {en ? "Booking Ref" : "رقم الحجز المرجعي"}: <b className="receipt-number-badge" dir="ltr">{b.bookingNumber}</b>
      </p>

      <link rel="stylesheet" href="https://cdn.moyasar.com/mpf/1.15.0/moyasar.css" />
      <Script src="https://cdn.moyasar.com/mpf/1.15.0/moyasar.js" onReady={() => setReady(true)} onError={() => setError(true)} />
      {error && (
        <div className="training-alert training-alert--error" role="alert">
          <AlertCircle size={20} className="training-alert__icon" aria-hidden="true" />
          <div className="training-alert__content">
            <p>{en ? "Payment form could not be loaded. Please refresh." : "تعذر تحميل نموذج الدفع. يرجى تحديث الصفحة."}</p>
          </div>
        </div>
      )}
      <div ref={paymentElement} className="sea-payment" />
      <Link className="text-link" href={"/booking/confirmation/" + b.id + "#token=" + token}>
        {en ? "Check booking status" : "متابعة حالة الحجز"}
      </Link>
    </div>
  );
}

export function Checkout({ cohort, enabled, demo = false }: { cohort: PublicCohort; enabled: boolean; demo?: boolean }) {
  const locale = useLocale();
  const en = locale === "en";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BookingResult | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const tokenFromHash = hash.get("token");
    const saved = search.get("booking") || sessionStorage.getItem("sea-active-" + cohort.id);
    if (!saved) return;
    const id = saved;
    const access = sessionStorage.getItem("sea-booking-" + id) || tokenFromHash;
    if (!access) return;
    sessionStorage.setItem("sea-booking-" + id, access);
    sessionStorage.setItem("sea-active-" + cohort.id, id);
    fetch("/api/bookings/" + id, { headers: { Authorization: "Bearer " + access }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (v?.booking?.status === "PENDING" && v.booking.holdExpiresAt > Date.now()) {
          setResult(v);
          setToken(access);
        } else if (v?.booking?.status === "EXPIRED" || v?.booking?.status === "CANCELLED") {
          sessionStorage.removeItem("sea-request-" + cohort.id);
          sessionStorage.removeItem("sea-active-" + cohort.id);
        }
      })
      .catch(() => {});
  }, [cohort.id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const values = new FormData(event.currentTarget);
      const keyName = "sea-request-" + cohort.id;
      let requestKey = sessionStorage.getItem(keyName);
      if (!requestKey) {
        requestKey = crypto.randomUUID();
        sessionStorage.setItem(keyName, requestKey);
      }
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: cohort.id,
          requestKey,
          locale,
          privacyConsent: values.get("consent") === "on",
          attendee: Object.fromEntries(["fullName", "nationalId", "mobile", "email"].map((name) => [name, values.get(name)])),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.status !== "PENDING") {
        sessionStorage.removeItem(keyName);
        throw new Error("REGISTRATION_CLOSED");
      }
      sessionStorage.setItem("sea-booking-" + body.id, body.accessToken);
      sessionStorage.setItem("sea-active-" + cohort.id, body.id);
      const details = await fetch("/api/bookings/" + body.id, { headers: { Authorization: "Bearer " + body.accessToken }, cache: "no-store" });
      if (!details.ok) throw new Error("SERVICE_UNAVAILABLE");
      setToken(body.accessToken);
      setResult(await details.json());
    } catch (caught) {
      setError(errorLabel(caught instanceof Error ? caught.message : "", en));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-shell page-shell">
      <div className="training-section-heading">
        <p className="eyebrow">{en ? "Single-seat booking" : "حجز مقعد واحد"}</p>
        <h1>{en ? "Your place in the next cohort" : "حجز مقعدك في الدفعة القادمة"}</h1>
        <p>{en ? "Enter the learner's details, then complete your payment." : "أدخل بيانات المتدرب بدقة ثم أكمل الدفع لتأكيد المقعد فورياً."}</p>
      </div>

      {demo && (
        <p className="training-demo-note" role="status">
          {en
            ? "Test environment — fictional learner details and Moyasar test cards only. This is not a real course enrolment."
            : "بيئة تجريبية — استخدم بيانات متدرب وهمية وبطاقات ميسر الاختبارية فقط. هذا ليس تسجيلاً فعلياً في دورة."}
        </p>
      )}

      <div className="checkout-grid">
        <section className="content-panel">
          {result ? (
            <PaymentForm data={result} token={token} locale={locale} />
          ) : !enabled || !cohort.open ? (
            <div className="training-empty">
              <h2>{en ? "Booking currently unavailable" : "الحجز غير متاح حالياً"}</h2>
              <p>{en ? "Please contact the Academy or choose another cohort." : "يرجى التواصل مع الأكاديمية أو اختيار دفعة أخرى."}</p>
              <Link href="/contact" className="button button--primary">
                {en ? "Contact us" : "تواصل معنا"}
              </Link>
            </div>
          ) : (
            <form className="training-form" onSubmit={submit}>
              <h2>{en ? "Learner Details" : "بيانات المتدرب"}</h2>
              <p className="training-note">{en ? "This booking is for one learner and one seat only." : "هذا الحجز لمتدرب واحد ومقعد واحد فقط."}</p>

              <label>
                {en ? "Full Name (as in National ID)" : "الاسم الرباعي (كما في الهوية الوطنية)"}
                <input name="fullName" autoComplete="name" minLength={6} maxLength={150} placeholder={en ? "e.g. Mohammed Ahmed Al-Ghamdi" : "مثال: محمد أحمد علي الغامدي"} required />
              </label>

              <label>
                {en ? "National ID / Iqama (10 digits)" : "رقم الهوية الوطنية / الإقامة (10 أرقام)"}
                <input name="nationalId" inputMode="numeric" pattern="[12][0-9]{9}" minLength={10} maxLength={10} placeholder={en ? "10 digits starting with 1 or 2" : "10 أرقام تبدأ بـ 1 أو 2"} required />
              </label>

              <label>
                {en ? "Mobile Number" : "رقم الجوال"}
                <input name="mobile" type="tel" autoComplete="tel" minLength={9} maxLength={20} placeholder="05xxxxxxxx" required />
              </label>

              <label>
                {en ? "Email Address" : "البريد الإلكتروني"}
                <input name="email" type="email" autoComplete="email" maxLength={254} placeholder="name@example.com" required />
              </label>

              <label className="training-consent">
                <input name="consent" type="checkbox" required />
                <span>
                  {en ? "I agree to the processing of my details for this booking according to the " : "أوافق على معالجة بياناتي لإتمام الحجز وفق "}
                  <Link href="/policies/privacy">{en ? "privacy policy" : "سياسة الخصوصية"}</Link>.
                </span>
              </label>

              {error && (
                <div className="training-alert training-alert--error" role="alert">
                  <AlertCircle size={22} className="training-alert__icon" aria-hidden="true" />
                  <div className="training-alert__content">
                    <strong>{en ? "Registration Notice" : "تنبيه أثناء التسجيل"}</strong>
                    <p>{error}</p>
                    {(error.includes("مسجل بالفعل") || error.includes("already registered")) && (
                      <span className="training-alert__hint">
                        {en
                          ? "This learner has already secured a seat in this cohort. Only 1 seat per National ID is allowed."
                          : "تم تأكيد مقعد لهذا المتدرب بالفعل في هذه الدفعة. يُسمح بمقعد واحد فقط لكل رقم هوية وطنية."}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <button className="button button--primary" disabled={busy}>
                {busy ? (en ? "Reserving seat…" : "جارٍ حفظ المقعد…") : en ? "Reserve Seat & Proceed to Payment" : "احفظ المقعد وانتقل للدفع"}
                {en ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
              </button>
            </form>
          )}
        </section>

        <aside className="cohort-card checkout-summary">
          <span className="seat-badge">{en ? "1 learner · 1 seat" : "متدرب واحد · مقعد واحد"}</span>
          <h2>{en ? cohort.titleEn : cohort.titleAr}</h2>
          <span className="cohort-code-badge">{cohort.cohortCode}</span>

          <div className="cohort-price-wrap">
            <strong className="cohort-price">
              {new Intl.NumberFormat(locale, { style: "currency", currency: "SAR" }).format(cohort.priceMinor / 100)}
            </strong>
            <span className="cohort-price-vat">{en ? "Total fee" : "شامل الضريبة"}</span>
          </div>

          <dl className="training-facts">
            <div>
              <Calendar size={15} className="training-facts__icon" />
              <dt>{en ? "Dates" : "الموعد"}</dt>
              <dd>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Asia/Riyadh" }).format(new Date(cohort.startAt))}</dd>
            </div>
            <div>
              <Clock size={15} className="training-facts__icon" />
              <dt>{en ? "Schedule" : "الجدول"}</dt>
              <dd>{en ? cohort.scheduleEn : cohort.scheduleAr}</dd>
            </div>
            <div>
              <Building2 size={15} className="training-facts__icon" />
              <dt>{en ? "Location" : "المقر"}</dt>
              <dd>{en ? cohort.venueEn : cohort.venueAr}</dd>
            </div>
          </dl>

          <p className="training-note" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Lock size={13} />
            {en ? "Seat is confirmed after successful payment verification." : "يُؤكد مقعدك فور التحقق الآمن من نجاح الدفع."}
          </p>
        </aside>
      </div>
    </div>
  );
}

export function BookingReceipt({ bookingId, callback = false }: { bookingId?: string; callback?: boolean }) {
  const en = useLocale() === "en";
  const [data, setData] = useState<BookingResult | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [id, setId] = useState(bookingId || "");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const booking = bookingId || search.get("booking") || "";
    const access = new URLSearchParams(window.location.hash.slice(1)).get("token") || sessionStorage.getItem("sea-booking-" + booking) || "";
    setId(booking);
    setToken(access);
    if (!booking || !access) {
      setError(errorLabel("BOOKING_ACCESS_DENIED", en));
      return;
    }
    sessionStorage.setItem("sea-booking-" + booking, access);
    let disposed = false;
    let verify = callback ? search.get("id") || sessionStorage.getItem("sea-payment-" + booking) : null;
    const refresh = async () => {
      try {
        if (verify) {
          const verified = await fetch("/api/bookings/" + encodeURIComponent(booking), {
            method: "POST",
            headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: verify }),
          });
          if (!verified.ok) throw new Error("SERVICE_UNAVAILABLE");
          verify = null;
        }
        const response = await fetch("/api/bookings/" + encodeURIComponent(booking), {
          headers: { Authorization: "Bearer " + access },
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        verify = null;
        if (!disposed) {
          setData(body);
          if (body?.cohort?.id) sessionStorage.setItem("sea-active-" + body.cohort.id, booking);
          setError("");
          if (body.booking?.status !== "PENDING") clearInterval(timer);
        }
      } catch (caught) {
        if (!disposed) setError(errorLabel(caught instanceof Error ? caught.message : "", en));
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [bookingId, callback, en]);

  const b = data?.booking;
  const states: Record<string, [string, string]> = {
    PENDING: ["بانتظار اكتمال الدفع", "Awaiting payment"],
    CONFIRMED: ["تم تأكيد مقعدك بنجاح", "Seat Confirmed"],
    EXPIRED: ["انتهت مهلة الحجز", "Reservation expired"],
    REFUND_PENDING: ["دفعة تحتاج مراجعة واسترجاع", "Payment awaiting review"],
    REFUNDED: ["تم استرجاع الدفعة", "Payment refunded"],
    CANCELLED: ["أُلغي الحجز", "Booking cancelled"],
  };

  return (
    <div className="booking-receipt page-shell">
      <div className="receipt-card">
        <div className="receipt-card__top-bar" />

        <div className="receipt-header">
          <div className="receipt-brand">
            <h2>{en ? "Saudi Entertainment Academy" : "الأكاديمية السعودية للترفيه"}</h2>
            <p>{en ? "Official Seat Registration Confirmation" : "إشعار تأكيد حجز مقعد تدريبي رسمي"}</p>
          </div>
          {b?.status === "CONFIRMED" && (
            <div className="official-stamp">
              <CheckCircle2 size={16} />
              <span>{en ? "OFFICIALLY CONFIRMED" : "معتمد ومؤكد رسمياً"}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="training-alert training-alert--error" role="alert">
            <AlertCircle size={22} className="training-alert__icon" aria-hidden="true" />
            <div className="training-alert__content">
              <strong>{en ? "Booking Error" : "تنبيه الحجز"}</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {b && data && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "22px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>{en ? "Booking Reference" : "الرقم المرجعي للحجز"}</span>
                <span className="receipt-number-badge" dir="ltr">{b.bookingNumber}</span>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>{en ? "Status" : "حالة الحجز"}</span>
                <span className={`status-badge status-badge--${b.status.toLowerCase().replace('_', '-')}`}>
                  {states[b.status]?.[en ? 1 : 0] || b.status}
                </span>
              </div>
            </div>

            <div className="receipt-details-grid">
              <div className="receipt-fact">
                <dt>{en ? "Learner Name" : "اسم المتدرب"}</dt>
                <dd>{b.fullName}</dd>
              </div>
              <div className="receipt-fact">
                <dt>{en ? "Program & Cohort" : "البرنامج والدفعة"}</dt>
                <dd>{en ? data.cohort.titleEn : data.cohort.titleAr} ({data.cohort.cohortCode})</dd>
              </div>
              <div className="receipt-fact">
                <dt>{en ? "Start Date" : "تاريخ البداية"}</dt>
                <dd>
                  {new Intl.DateTimeFormat(en ? "en" : "ar", { dateStyle: "long", timeZone: "Asia/Riyadh" }).format(new Date(data.cohort.startAt))}
                </dd>
              </div>
              <div className="receipt-fact">
                <dt>{en ? "Schedule & Venue" : "الجدول والمقر"}</dt>
                <dd>{en ? data.cohort.venueEn : data.cohort.venueAr} · {en ? data.cohort.scheduleEn : data.cohort.scheduleAr}</dd>
              </div>
              <div className="receipt-fact">
                <dt>{en ? "Amount Paid" : "المبلغ المدفوع"}</dt>
                <dd style={{ color: "var(--sea-primary)", fontSize: "18px" }}>
                  {new Intl.NumberFormat(en ? "en-SA" : "ar-SA", { style: "currency", currency: b.currency }).format(b.amountMinor / 100)}
                </dd>
              </div>
              <div className="receipt-fact">
                <dt>{en ? "Payment Gateway" : "وسيلة السداد"}</dt>
                <dd>{en ? "Electronic Payment (Moyasar)" : "سداد إلكتروني معتمد (Moyasar)"}</dd>
              </div>
            </div>

            <div className="receipt-actions">
              {b.status === "CONFIRMED" && (
                <button className="button button--primary no-print" onClick={() => window.print()}>
                  <Printer size={16} />
                  {en ? "Print Official Receipt / PDF" : "طباعة الإشعار الرسمي / حفظ PDF"}
                </button>
              )}
              {b.status === "PENDING" && (
                <Link className="button button--primary" href={"/checkout/" + data.cohort.id + (token ? "#token=" + token : "")}>
                  {en ? "Continue Payment" : "متابعة إتمام الدفع"}
                </Link>
              )}
              {callback && (
                <Link className="text-link no-print" href={"/booking/confirmation/" + id + "#token=" + token}>
                  {en ? "Bookmark this receipt" : "احتفظ برابط الإشعار"}
                </Link>
              )}
              <Link className="text-link no-print" href="/programs" style={{ marginInlineStart: "auto" }}>
                {en ? "Back to Programs" : "العودة للبرامج"}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
