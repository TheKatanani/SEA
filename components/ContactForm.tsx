"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpLeft, ArrowUpRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Field = { name: string; label: string; type?: "text" | "email" | "tel" | "select" | "textarea"; required?: boolean; options?: string[]; placeholder?: string; full?: boolean };
type FormType = "quick_interest" | "application_interest" | "employer_inquiry" | "future_diploma_interest" | "contact_inquiry";

function UiOnlyForm({ title, description, fields, formType, buttonLabel = "إرسال", english = false }: { title: string; description?: string; fields: Field[]; formType: FormType; buttonLabel?: string; english?: boolean }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const t = useTranslations("forms");
  const locale = useLocale();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setServerError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const entries = Object.fromEntries([...values.entries()].filter(([key]) => !["privacyConsent", "website"].includes(key)));
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formType, locale, fields: entries, privacyConsent: values.get("privacyConsent") === "on", website: values.get("website") }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(typeof result?.error === "string" ? result.error : "Submission failed");
      }
      setStatus("success");
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setServerError(message.includes("not enabled") || message.includes("not configured")
        ? (english ? "The form is temporarily unavailable. Please contact the Academy." : "النموذج غير متاح مؤقتًا. يرجى التواصل مع الأكاديمية.")
        : t("error"));
      setStatus("error");
    }
  }

  if (status === "success") return <div className="form-success" role="status"><span className="form-success__icon"><CheckCircle2 size={28} /></span><h3>{t("success")}</h3><p>{t("successDescription")}</p><button className="text-link" type="button" onClick={() => setStatus("idle")}>{t("another")}</button></div>;

  return <form className={`form-grid ${english ? "form-grid--english" : ""}`} onSubmit={submit}>
    <h2 className="form-title form-field--full">{title}</h2>
    {description && <p className="form-description form-field--full">{description}</p>}
    {fields.map((field) => <label className={`field ${field.full ? "form-field--full" : ""}`} key={field.name}>
      <span>{field.label}{field.required ? " *" : ""}</span>
      {field.type === "select" ? <select name={field.name} required={field.required} defaultValue=""><option value="" disabled>{field.placeholder ?? t("choose")}</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
        : field.type === "textarea" ? <textarea name={field.name} rows={4} placeholder={field.placeholder} required={field.required} maxLength={2000} />
          : <input name={field.name} type={field.type ?? "text"} placeholder={field.placeholder} required={field.required} maxLength={200} autoComplete={field.name === "email" ? "email" : field.name.toLowerCase().includes("phone") ? "tel" : undefined} />}
    </label>)}
    <div className="form-field--full privacy-consent"><label><input type="checkbox" name="privacyConsent" required /><span>{t("privacyConsent")} <Link href="/policies/privacy">{english ? "Read the policy" : "اقرأ السياسة"}</Link></span></label></div>
    <label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="form-footer form-footer--full"><p>{t("noSave")}</p><button className="button button--primary" type="submit" disabled={status === "submitting"}>{status === "submitting" ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}{buttonLabel}{status === "submitting" ? ` ${t("submitting")}` : english ? <ArrowUpRight size={16} aria-hidden="true" /> : <ArrowUpLeft size={16} aria-hidden="true" />}</button></div>
    {status === "error" && <p className="form-error form-field--full" role="alert">{serverError || t("error")}</p>}
  </form>;
}

type FormRecord = { id: string; status?: string; locales?: Record<string, { title?: string; description?: string; buttonLabel?: string; fields?: Field[] }> };

export function ManagedForm({ formType }: { formType: FormType }) {
  const english = useLocale() === "en";
  const [form, setForm] = useState<FormRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/site/content?collection=forms", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Form definitions are unavailable");
        return response.json();
      })
      .then((result) => {
        const record = (Array.isArray(result?.items) ? result.items : []).find((item: FormRecord) => item.id === formType);
        setForm(record || null);
        setLoadError(false);
      }).catch(() => { if (!controller.signal.aborted) { setForm(null); setLoadError(true); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [formType]);

  if (loading) return <p className="cms-collection-state" aria-live="polite">{english ? "Loading form…" : "جارٍ تحميل النموذج…"}</p>;
  if (loadError) return <p className="cms-collection-state" role="alert">{english ? "The form could not be loaded. Please try again later." : "تعذر تحميل النموذج. يرجى المحاولة لاحقًا."}</p>;
  if (!form) return <p className="cms-collection-state" role="status">{english ? "This form is not published yet." : "هذا النموذج غير منشور حاليًا."}</p>;
  const localized = form.locales?.[english ? "en" : "ar"];
  if (!localized || !Array.isArray(localized.fields)) return <p className="cms-collection-state" role="status">{english ? "This form is not available in this language." : "هذا النموذج غير متاح بهذه اللغة."}</p>;
  if (localized.fields.some((field) => field.type === "select" && (!Array.isArray(field.options) || field.options.length === 0))) return <p className="cms-collection-state" role="alert">{english ? "This form needs its choices configured. Please contact the Academy." : "يحتاج النموذج إلى إعداد خياراته. يرجى التواصل مع الأكاديمية."}</p>;
  return <UiOnlyForm english={english} formType={formType} title={localized.title || ""} description={localized.description} buttonLabel={localized.buttonLabel || (english ? "Submit" : "إرسال")} fields={localized.fields} />;
}

export function QuickRegistrationForm() { return <ManagedForm formType="quick_interest" />; }
export function ApplicationForm() { return <ManagedForm formType="application_interest" />; }
export function EmployerIntakeForm() { return <ManagedForm formType="employer_inquiry" />; }
export function CompanyRegistrationForm() { return <EmployerIntakeForm />; }
export function FutureDiplomaForm() { return <ManagedForm formType="future_diploma_interest" />; }
export function ContactInquiryForm() { return <ManagedForm formType="contact_inquiry" />; }
