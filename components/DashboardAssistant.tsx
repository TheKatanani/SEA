"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { reportLabels, reportNames, type buildInsight } from "@/lib/admin/insights";
import { statusLabel } from "@/lib/admin/records";
export function DashboardAssistant({ english: en, available, request, onOpen }: { english: boolean; available: boolean; request: (url: string, init?: RequestInit) => Promise<any>; onOpen: (collection: string, id: string) => void }) {
  const [question, setQuestion] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [result, setResult] = useState<ReturnType<typeof buildInsight> | null>(null);
  const generation = useRef(0), pending = useRef(false);
  useEffect(() => () => { generation.current++; }, []);
  async function ask(body: { question: string } | { report: string }) {
    if (pending.current) return; pending.current = true;
    const id = ++generation.current; setBusy(true); setError(""); setResult(null);
    try { const response = await request("/api/admin/ai/insights", { method: "POST", body: JSON.stringify(body) }); if (generation.current === id) setResult(response); }
    catch (caught) { if (generation.current === id) { const code = caught instanceof Error ? caught.message : ""; setError(code === "INSIGHT_UNSUPPORTED" ? en ? "Choose one of the four reports below. Other questions are not supported yet." : "اختر أحد التقارير الأربعة أدناه. الأسئلة الأخرى غير مدعومة حالياً." : code === "INSIGHT_DATA_LIMIT" ? en ? "Too many records for a complete report. Open Training to filter the records." : "عدد السجلات كبير لإعداد تقرير كامل. افتح التدريب لتصفية السجلات." : en ? "Could not load this report. Retry or open Training." : "تعذر تحميل التقرير. أعد المحاولة أو افتح التدريب."); } }
    finally { if (generation.current === id) { setBusy(false); pending.current = false; } }
  }
  return <section className="record-ai-panel dashboard-assistant"><h3><Sparkles size={18} />{en ? "Ask your dashboard" : "اسأل لوحة الإدارة"}</h3><p>{en ? "Ask about training readiness or choose a report. Results use current records and never change them." : "اسأل عن جاهزية التدريب أو اختر تقريراً. النتائج من سجلاتك الحالية ولا تُجري تعديلات عليها."}</p>
    <div className="dashboard-question"><label className="structured-field"><span>{en ? "Your question" : "سؤالك"}</span><input maxLength={500} value={question} onChange={e => setQuestion(e.target.value)} placeholder={en ? "Which courses have no upcoming bookable cohorts?" : "ما الدورات التي لا توجد لها دفعات قادمة متاحة للحجز؟"} onKeyDown={e => { if (e.key === "Enter" && available && question.trim().length >= 3) { e.preventDefault(); void ask({ question: question.trim() }); } }} /></label><button type="button" className="admin-secondary-button" disabled={!available || busy || question.trim().length < 3} onClick={() => void ask({ question: question.trim() })}>{en ? "Ask" : "اسأل"}</button></div>
    {!available && <small>{en ? "AI is unavailable. The report buttons below still work." : "المساعد غير متاح. أزرار التقارير أدناه تعمل كالمعتاد."}</small>}
    <div className="assistant-actions">{reportNames.map(report => <button type="button" className="admin-secondary-button" key={report} disabled={busy} onClick={() => void ask({ report })}>{reportLabels[report][en ? "en" : "ar"]}</button>)}</div>
    {busy && <p role="status"><LoaderCircle className="spin" size={16} />{en ? "Checking current records…" : "جارٍ فحص السجلات الحالية…"}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    {result && <div aria-live="polite"><h4>{reportLabels[result.report][en ? "en" : "ar"]} · {result.total}</h4><small>{en ? "Checked: " : "وقت الفحص: "}{new Intl.DateTimeFormat(en ? "en-GB" : "ar-SA", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Riyadh", calendar: "gregory" }).format(new Date(result.checkedAt))}{result.limited ? en ? " · First 100 results shown" : " · تظهر أول 100 نتيجة" : ""}</small><div className="admin-data-scroll"><table className="admin-data-table"><thead><tr><th>{en ? "Course / cohort" : "الدورة / الدفعة"}</th><th>{en ? "Status" : "الحالة"}</th><th>{en ? "Seats left / capacity" : "المتاح / السعة"}</th><th>{en ? "Action" : "الإجراء"}</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.collection + row.id}><td>{en ? row.titleEn : row.titleAr}</td><td>{statusLabel(row.status, en)}</td><td>{row.remaining === null ? "—" : row.remaining + " / " + row.capacity}</td><td><button type="button" className="text-link" onClick={() => onOpen(row.collection, row.id)}>{en ? "Open" : "فتح"}</button></td></tr>)}{!result.rows.length && <tr><td colSpan={4}>{en ? "No matching records." : "لا توجد سجلات مطابقة."}</td></tr>}</tbody></table></div></div>}
  </section>;
}
