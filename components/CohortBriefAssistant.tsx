"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, LoaderCircle } from "lucide-react";
import { applyCohortSuggestions, cohortAiKeys, type CohortAiSuggestion } from "@/lib/admin/cohort-ai";
import { cohortFieldName, type CohortFormValues } from "@/lib/admin/cohort-form";
import { textHash } from "@/lib/admin/content";
type Result = { fields: CohortAiSuggestion[]; sourceHash: string };
export function CohortBriefAssistant({ value, english: en, available, request, onChange }: { value: CohortFormValues; english: boolean; available: boolean; request: (url: string, init?: RequestInit) => Promise<any>; onChange: (next: CohortFormValues) => void }) {
  const [brief, setBrief] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [result, setResult] = useState<Result | null>(null), [selected, setSelected] = useState<string[]>([]);
  const baseline = useRef(value), current = useRef(value), generation = useRef(0), pending = useRef(false);
  current.current = value;
  const identity = [value.id, value.programCollection, value.programId].join(":");
  useEffect(() => { generation.current++; setResult(null); setSelected([]); setBusy(false); pending.current = false; setError(""); setNotice(""); }, [identity]);
  useEffect(() => () => { generation.current++; }, []);
  async function prepare() {
    if (pending.current) return;
    const id = ++generation.current; pending.current = true; baseline.current = { ...current.current }; setBusy(true); setError(""); setNotice(""); setResult(null);
    try {
      const data: Result = await request("/api/admin/ai/cohort", { method: "POST", body: JSON.stringify({ brief: brief.trim() }) });
      if (generation.current !== id || data.sourceHash !== textHash(brief.trim())) return;
      setResult(data); setSelected(data.fields.filter(f => !String(current.current[f.key]).trim()).map(f => f.key));
    } catch (caught) { if (generation.current === id) setError(caught instanceof Error && caught.message.includes("QUOTA") ? en ? "AI limit reached. Continue manually." : "وصلت إلى حد المساعد. تابع يدوياً." : en ? "Could not prepare suggestions. Your form is unchanged; retry or enter details manually." : "تعذر تجهيز الاقتراحات. بيانات النموذج محفوظة؛ أعد المحاولة أو تابع يدوياً."); }
    finally { if (generation.current === id) { setBusy(false); pending.current = false; } }
  }
  const valid = result?.sourceHash === textHash(brief.trim());
  const eligible = (field: CohortAiSuggestion) => !String(value[field.key]).trim() && value[field.key] === baseline.current[field.key];
  return <section className="record-ai-panel" aria-label={en ? "Fill cohort from details" : "تعبئة الدفعة من التفاصيل"}>
    <h3><Sparkles size={18} />{en ? "Paste details → prepare your cohort" : "الصق التفاصيل ← جهّز الدفعة"}</h3>
    <p>{en ? "Paste the course announcement once. Review extracted fees, seats, dates, schedule and venue in both languages before applying. Existing entries are kept." : "الصق إعلان الدورة مرة واحدة. راجع الرسوم والمقاعد والمواعيد والجدول والموقع باللغتين ثم اقبل تعبئتها. ستبقى بياناتك المدخلة كما هي."}</p>
    <label className="structured-field"><span>{en ? "Cohort details · use dummy data while testing" : "تفاصيل الدفعة · استخدم بيانات وهمية أثناء التجربة"}</span><textarea rows={4} maxLength={8000} value={brief} onChange={e => { generation.current++; pending.current = false; setBusy(false); setBrief(e.target.value); setResult(null); setNotice(""); }} placeholder={en ? "Fee: 500 SAR. Capacity: 25 seats. Start: 2026-11-15 09:00. End: 2026-11-19 15:00. Schedule: Sunday–Thursday, 09:00–15:00. Venue: SEA, Riyadh." : "الرسوم: 500 ريال. السعة: 25 مقعداً. البداية: 2026-11-15 09:00. النهاية: 2026-11-19 15:00. الجدول: الأحد إلى الخميس، 09:00–15:00. الموقع: الأكاديمية، الرياض."} /></label>
    <small>{en ? "Dates: YYYY-MM-DD HH:mm, 24-hour Riyadh time. Missing or ambiguous facts stay empty. No learner or payment details." : "المواعيد: YYYY-MM-DD HH:mm، بنظام 24 ساعة وتوقيت الرياض. لن تُخمن البيانات الناقصة أو المبهمة. لا تُدرج بيانات المتعلمين أو المدفوعات."}</small>
    <div className="assistant-actions"><button type="button" className="admin-secondary-button" disabled={!available || busy || brief.trim().length < 10} onClick={() => void prepare()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}{en ? "Prepare form suggestions" : "تجهيز اقتراحات النموذج"}</button>{!available && <small>{en ? "AI unavailable. Saved details and manual editing still work." : "المساعد غير متاح. يمكنك استخدام البيانات المحفوظة أو الإدخال اليدوي."}</small>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {result && valid && <div className="record-ai-results"><div className="admin-data-scroll"><table className="admin-data-table"><thead><tr><th>{en ? "Use" : "تعبئة"}</th><th>{en ? "Field" : "الحقل"}</th><th>{en ? "Suggested value" : "القيمة المقترحة"}</th><th>{en ? "From your details" : "من تفاصيلك"}</th></tr></thead><tbody>{result.fields.map(field => <tr key={field.key}><td><input type="checkbox" aria-label={(en ? "Use " : "تعبئة ") + cohortFieldName(field.key, en)} checked={eligible(field) && selected.includes(field.key)} disabled={!eligible(field)} onChange={e => setSelected(old => e.target.checked ? [...old, field.key] : old.filter(k => k !== field.key))} /></td><td>{cohortFieldName(field.key, en)}{!eligible(field) && <small>{en ? "Already entered · kept" : "مدخلة مسبقاً · تم الاحتفاظ بها"}</small>}</td><td dir={field.key.endsWith("Ar") ? "rtl" : "ltr"}>{field.text}</td><td><small>{field.evidence}</small></td></tr>)}</tbody></table></div>
      <p>{en ? "Not supplied: " : "لم ترد في النص: "}{cohortAiKeys.filter(key => !String(value[key]).trim() && !result.fields.some(f => f.key === key)).map(key => cohortFieldName(key, en)).join(en ? ", " : "، ") || (en ? "None" : "لا شيء")}</p>
      <button type="button" className="admin-secondary-button" disabled={!result.fields.some(f => eligible(f) && selected.includes(f.key))} onClick={() => { const next = applyCohortSuggestions(current.current, baseline.current, result.fields, selected); onChange(next); setResult(null); setNotice(en ? "Selected facts applied. Review the form, then save a draft." : "تمت تعبئة البيانات المختارة. راجع النموذج ثم احفظ المسودة."); }}>{en ? "Confirm and fill selected fields" : "تأكيد وتعبئة الحقول المختارة"}</button>
    </div>}
  </section>;
}
