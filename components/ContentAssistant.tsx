"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Languages, Check, X, LoaderCircle } from "lucide-react";
import { applyText, buildTranslationState, fieldsFor, textHash, textPairs, type ContentRecord, type Locale, type TranslationState } from "@/lib/admin/content";
import { assistanceBatch, suggestionIsCurrent } from "@/lib/admin/assistance";
type Suggestion = { key: string; text: string; sourceHash: string; sourceText: string; locale: Locale; action: string };
type Result = { fields?: Array<{ key: string; text: string; sourceHash: string }> };
export function ContentAssistant({ collection, value, baseline, locale, english: en, available, metadata = {}, reviewed = [], onReview, onChange, request }: {
  collection: string; value: ContentRecord; baseline?: ContentRecord; locale: Locale; english: boolean; available: boolean; metadata?: TranslationState; reviewed?: string[];
  onReview: (keys: string[]) => void; onChange: (value: ContentRecord, aiKey?: string) => void; request: (url: string, init?: RequestInit) => Promise<Result>;
}) {
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [completedBatch, setCompletedBatch] = useState(0);
  const [instruction, setInstruction] = useState(""), [selected, setSelected] = useState("");
  const generation = useRef(0), mounted = useRef(true), currentValue = useRef(value);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seen = useRef(new Set<string>()), cache = useRef(new Map<string, Suggestion[]>());
  currentValue.current = value;
  const pairs = useMemo(() => textPairs(collection, value, locale), [collection, value, locale]);
  const initial = useRef(textPairs(collection, baseline || value, locale));
  const target: Locale = locale === "ar" ? "en" : "ar";
  const state = buildTranslationState(collection, value, baseline, metadata, reviewed);
  const signature = JSON.stringify(pairs.map(p => [p.key, p.source, p.target]));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  const label = (key: string) => {
    const field = fieldsFor(collection).find(f => f.key === key.split(".")[0]);
    if (field) return en ? field.en : field.ar;
    const index = Number(key.split(".")[1]) + 1;
    return key.startsWith("sections.") ? (en ? "Section " : "المقطع ") + index : key.startsWith("fields.") ? (en ? "Form field " : "حقل النموذج ") + index : en ? "Website text" : "نص الموقع";
  };
  async function generate(action: "draft" | "improve" | "shorten" | "translate", keys: string[], automatic = false) {
    if (!automatic) clearTimeout(autoTimer.current);
    const fields = assistanceBatch(pairs, keys, action, instruction);
    if (!available || !fields.length) { if (!automatic) setError(en ? "Add a short source text or brief first." : "أضف نصاً أو وصفاً مختصراً أولاً."); return; }
    if (action === "draft" && !instruction.trim()) { setError(en ? "Describe the facts to include in the brief below." : "اكتب الحقائق التي تريد تضمينها في الوصف أدناه."); return; }
    const requestKey = JSON.stringify([collection, locale, action, instruction, fields]);
    const id = ++generation.current; setBusy(true); setError("");
    if (action === "translate") fields.forEach(f => seen.current.add(locale + ":" + f.key + ":" + textHash(f.text)));
    try {
      let entries = cache.current.get(requestKey);
      if (!entries) {
        const result = await request("/api/admin/ai", { method: "POST", body: JSON.stringify({ collection, action, sourceLocale: locale, targetLocale: action === "translate" ? target : locale, fields, ...(action === "draft" ? { instruction } : {}) }) });
        entries = (result.fields || []).map(f => ({ ...f, sourceText: fields.find(p => p.key === f.key)?.text || "", locale: action === "translate" ? target : locale, action }));
        if (cache.current.size >= 100) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(requestKey, entries);
      }
      if (!mounted.current || generation.current !== id) return;
      const currentPairs = textPairs(collection, currentValue.current, locale);
      setSuggestions(old => ({ ...old, ...Object.fromEntries(entries!.filter(s => suggestionIsCurrent(s, currentPairs)).map(s => [s.key, s])) }));
      if (automatic) setCompletedBatch(count => count + 1);
    } catch (caught) {
      if (!mounted.current || generation.current !== id) return;
      const message = caught instanceof Error ? caught.message : "";
      setError(message.includes("QUOTA") ? en ? "AI limit reached. Continue editing manually, or try later." : "وصلت إلى حد المساعد. يمكنك متابعة التحرير يدوياً أو المحاولة لاحقاً." : en ? "Suggestions are unavailable. Your text is safe; edit manually or retry." : "تعذرت الاقتراحات. نصك محفوظ في المحرر؛ تابع يدوياً أو أعد المحاولة.");
    } finally { if (mounted.current && generation.current === id) setBusy(false); }
  }
  useEffect(() => {
    generation.current++; setBusy(false);
    if (!available) return;
    const changed = pairs.filter(p => p.source.trim() && (!p.target.trim() || state[locale + ":" + p.key]?.status === "outdated" || initial.current.find(v => v.key === p.key)?.source !== p.source) && !seen.current.has(locale + ":" + p.key + ":" + textHash(p.source)));
    if (!changed.length) return;
    autoTimer.current = setTimeout(() => void generate("translate", changed.map(p => p.key), true), 1500);
    return () => clearTimeout(autoTimer.current);
    // Only text changes restart automatic suggestions; UI state must not trigger requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, locale, available, completedBatch]);
  const selectedKey = pairs.some(p => p.key === selected) ? selected : pairs[0]?.key || "";
  function accept(s: Suggestion) {
    const pair = textPairs(collection, value, locale).find(p => p.key === s.key);
    if (!pair || !suggestionIsCurrent(s, [pair])) { setError(en ? "The source changed. Generate a new suggestion." : "تغير النص الأصلي. اطلب اقتراحاً جديداً."); return; }
    try { onChange(applyText(value, collection, s.locale, s.key, s.text, locale), locale + ":" + s.key); setSuggestions(old => { const next = { ...old }; delete next[s.key]; return next; }); }
    catch { setError(en ? "Align the form fields in both languages first." : "وحّد ترتيب حقول النموذج في اللغتين أولاً."); }
  }
  return <aside className="content-assistant" aria-label={en ? "Writing & translation" : "الكتابة والترجمة"}>
    <div className="assistant-heading"><h3><Sparkles size={18} />{en ? "Writing & translation" : "الكتابة والترجمة"}</h3>{busy && <LoaderCircle className="spin" size={18} aria-label={en ? "Generating suggestions" : "جارٍ إعداد الاقتراحات"} />}</div>
    {!available && <p className="assistant-note">{en ? "AI is not connected. You can write, translate and publish manually." : "المساعد غير متصل. يمكنك الكتابة والترجمة والنشر يدوياً."}</p>}
    {available && <><label className="structured-field"><span>{en ? "Text to assist with" : "النص المطلوب مساعدتك فيه"}</span><select value={selectedKey} onChange={e => setSelected(e.target.value)}>{pairs.map(p => <option key={p.key} value={p.key}>{label(p.key)}</option>)}</select></label>
      {collection !== "policies" && <label className="structured-field"><span>{en ? "Brief for drafting (facts only)" : "وصف لصياغة النص (الحقائق فقط)"}</span><textarea rows={2} maxLength={1200} value={instruction} onChange={e => setInstruction(e.target.value)} /></label>}
      <div className="assistant-actions">{(collection === "policies" ? ["improve", "translate"] as const : ["draft", "improve", "shorten", "translate"] as const).map(action => <button type="button" key={action} className="admin-secondary-button" disabled={busy || !selectedKey} onClick={() => void generate(action, [selectedKey])}>{({ draft: en ? "Draft text" : "صياغة نص", improve: en ? "Improve wording" : "تحسين الصياغة", shorten: en ? "Shorten" : "اختصار", translate: en ? "Translate again" : "إعادة الترجمة" })[action]}</button>)}</div></>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <h4><Languages size={16} />{target === "ar" ? "العربية" : "English"}</h4>
    {pairs.filter(p => p.source.trim() || suggestions[p.key] && suggestionIsCurrent(suggestions[p.key], [p])).map(pair => {
      const key = locale + ":" + pair.key, suggestion = suggestions[pair.key];
      const validSuggestion = suggestion && suggestionIsCurrent(suggestion, [pair]);
      const status = validSuggestion ? "suggested" : state[key]?.status || (pair.target.trim() ? "reviewed" : "missing");
      return <section className="translation-field" key={pair.key}><div className="translation-field__heading"><strong>{label(pair.key)}</strong><span className={"translation-status translation-status--" + status}>{({ missing: en ? "Missing" : "مفقودة", suggested: en ? "Needs review" : "تحتاج مراجعة", reviewed: en ? "Reviewed" : "مراجعة", outdated: en ? "Outdated" : "قديمة" })[status]}</span></div>
        <textarea dir={target === "ar" ? "rtl" : "ltr"} aria-label={(en ? "Translation: " : "الترجمة: ") + label(pair.key)} value={pair.target} rows={3} onChange={e => { try { onChange(applyText(value, collection, target, pair.key, e.target.value, locale)); } catch { setError(en ? "Align form fields first." : "وحّد ترتيب حقول النموذج أولاً."); } }} />
        {validSuggestion && <div className="ai-suggestion"><label>{en ? "Suggested " + (suggestion.locale === "ar" ? "Arabic" : "English") + " text — edit before accepting" : "نص " + (suggestion.locale === "ar" ? "عربي" : "إنجليزي") + " مقترح — يمكنك تعديله قبل القبول"}<textarea dir={suggestion.locale === "ar" ? "rtl" : "ltr"} value={suggestion.text} onChange={e => setSuggestions(old => ({ ...old, [pair.key]: { ...suggestion, text: e.target.value } }))} rows={3} /></label><div className="assistant-actions"><button type="button" className="admin-secondary-button" onClick={() => accept(suggestion)}><Check size={14} />{en ? "Accept" : "قبول"}</button><button type="button" className="admin-secondary-button" onClick={() => setSuggestions(old => { const next = { ...old }; delete next[pair.key]; return next; })}><X size={14} />{en ? "Dismiss" : "تجاهل"}</button></div></div>}
        {pair.target.trim() && status !== "reviewed" && <button type="button" className="text-link" onClick={() => onReview([...new Set([...reviewed, key, target + ":" + pair.key])])}>{en ? "Mark translation reviewed" : "اعتماد مراجعة الترجمة"}</button>}
      </section>;
    })}
    {!pairs.some(p => p.source.trim()) && <p className="assistant-note">{en ? "Start writing to review the other language here." : "ابدأ الكتابة لمراجعة اللغة الأخرى هنا."}</p>}
  </aside>;
}
