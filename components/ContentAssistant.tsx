"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sparkles, Languages, Check, X, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { allowedTextPath, applyText, buildTranslationState, fieldsFor, getPath, localePath, setPath, textHash, textPairs, type ContentRecord, type Locale, type TranslationState } from "@/lib/admin/content";
import { assistanceBatch, editableTextPairs, suggestionIsCurrent, translationTasks } from "@/lib/admin/assistance";
import { reviewHash } from "@/lib/admin/ai-review";

type Action = "draft" | "improve" | "shorten" | "translate";
type Suggestion = { key: string; text: string; sourceHash: string; sourceText: string; targetText?: string; sourceLocale: Locale; locale: Locale };
type Result = { fields?: Array<{ key: string; text: string; sourceHash: string }>; issues?: Array<{ key: string; messageAr: string; messageEn: string }>; sourceHash?: string };
type AssistantContext = {
  collection: string; value: ContentRecord; english: boolean; available: boolean; busy: boolean; busyKeys: string[];
  state: TranslationState; suggestions: Record<string, Suggestion>;
  change: (key: string, locale: Locale, text: string) => void;
  generate: (action: Action, locale: Locale, keys: string[], brief?: string) => Promise<void>;
  accept: (id: string) => void; dismiss: (id: string) => void; editSuggestion: (id: string, text: string) => void;
  review: (key: string) => void; register: (key: string) => () => void;
  onChange: (value: ContentRecord) => void;
};
const Context = createContext<AssistantContext | null>(null);
const other = (locale: Locale): Locale => locale === "ar" ? "en" : "ar";
const nameOf = (locale: Locale) => locale === "ar" ? "العربية" : "English";

export function ContentAssistant({ collection, value, baseline, english: en, available, metadata = {}, reviewed = [], onReview, onChange, request, children }: {
  collection: string; value: ContentRecord; baseline?: ContentRecord; english: boolean; available: boolean;
  metadata?: TranslationState; reviewed?: string[]; onReview: (keys: string[]) => void;
  onChange: (value: ContentRecord, aiKey?: string) => void; request: (url: string, init?: RequestInit) => Promise<Result>; children: ReactNode;
}) {
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [busyKeys, setBusyKeys] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [automatic, setAutomatic] = useState(true), [completed, setCompleted] = useState(0);
  const [brief, setBrief] = useState(""), [draftLocale, setDraftLocale] = useState<Locale>("ar"), [batchBusy, setBatchBusy] = useState(false);
  const batchRunning = useRef(false);
  const [reviewResult, setReviewResult] = useState<{ signature: string; issues: NonNullable<Result["issues"]>; checked: number; skipped: number } | null>(null);
  const current = useRef(value), mounted = useRef(true), pending = useRef(false);
  const seen = useRef(new Set<string>()), cache = useRef(new Map<string, Suggestion[]>());
  const activeFields = useRef(new Map<string, number>()), directions = useRef(new Map<string, Locale>());
  current.current = value;
  const state = useMemo(() => buildTranslationState(collection, value, baseline, metadata, reviewed), [collection, value, baseline, metadata, reviewed]);
  const pairs = useMemo(() => ({ ar: textPairs(collection, value, "ar"), en: textPairs(collection, value, "en") }), [collection, value]);
  const signature = JSON.stringify([pairs.ar, pairs.en]);
  const tasks = translationTasks(collection, value, baseline, metadata, reviewed);
  const fieldLabel = (key: string) => fieldsFor(collection).find(f => f.key === key.split(".")[0])?.[en ? "en" : "ar"] || (en ? "Content field" : "حقل محتوى");
  const currentSuggestions = Object.entries(suggestions).filter(([, entry]) => suggestionIsCurrent(entry, editableTextPairs(collection, value, entry.sourceLocale, [entry.key])));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function register(key: string) {
    activeFields.current.set(key, (activeFields.current.get(key) || 0) + 1);
    return () => { const count = (activeFields.current.get(key) || 1) - 1; if (count) activeFields.current.set(key, count); else activeFields.current.delete(key); };
  }
  function change(key: string, locale: Locale, text: string) {
    try {
      directions.current.set(key, locale);
      onChange(allowedTextPath(collection, key) ? applyText(current.current, collection, locale, key, text, other(locale)) : setPath(current.current, localePath(collection, locale, key), text));
    } catch { setError(en ? "Align the form fields in both languages first." : "وحّد ترتيب حقول النموذج في اللغتين أولاً."); }
  }
  async function generate(action: Action, locale: Locale, keys: string[], brief = "") {
    if (!available || pending.current) return;
    const fields = assistanceBatch(editableTextPairs(collection, current.current, locale, keys), keys, action, brief);
    const snapshot = editableTextPairs(collection, current.current, locale, keys);
    if (!fields.length || action === "draft" && !brief.trim()) return;
    pending.current = true; setBusy(true); setBusyKeys(fields.map(field => field.key)); setError("");
    const cacheKey = JSON.stringify([collection, locale, action, brief, fields]);
    if (action === "translate") fields.forEach(field => seen.current.add(locale + ":" + field.key + ":" + textHash(field.text)));
    try {
      let entries = cache.current.get(cacheKey);
      if (!entries) {
        const result = await request("/api/admin/ai", { method: "POST", body: JSON.stringify({ collection, action, sourceLocale: locale, targetLocale: action === "translate" ? other(locale) : locale, fields, ...(action === "draft" ? { instruction: brief } : {}) }) });
        entries = (result.fields || []).map(field => ({ ...field, sourceText: fields.find(v => v.key === field.key)?.text || "", sourceLocale: locale, locale: action === "translate" ? other(locale) : locale }));
        if (cache.current.size >= 100) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(cacheKey, entries);
      }
      entries = entries.map(entry => ({ ...entry, ...(action === "translate" ? { targetText: snapshot.find(pair => pair.key === entry.key)?.target || "" } : {}) }));
      if (!mounted.current) return;
      const now = editableTextPairs(collection, current.current, locale, fields.map(field => field.key));
      setSuggestions(old => ({ ...old, ...Object.fromEntries(entries.filter(entry => suggestionIsCurrent(entry, now)).map(entry => [entry.locale + ":" + entry.key, entry])) }));
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error && caught.message.includes("QUOTA")
        ? en ? "AI limit reached. You can continue editing manually." : "وصلت إلى حد المساعد. يمكنك متابعة التحرير يدوياً."
        : en ? "Suggestions are unavailable. Your text is safe; continue manually or retry." : "تعذرت الاقتراحات. نصك محفوظ في المحرر؛ تابع يدوياً أو أعد المحاولة.");
    } finally {
      pending.current = false;
      if (mounted.current) { setBusy(false); setBusyKeys([]); setCompleted(v => v + 1); }
    }
  }
  useEffect(() => {
    if (!available || !automatic || busy || batchBusy) return;
    const timer = setTimeout(() => {
      for (const locale of ["ar", "en"] as const) {
        const changed = pairs[locale].filter(pair => {
          if (!activeFields.current.has(pair.key) || !pair.source.trim()) return false;
          const direction = directions.current.get(pair.key);
          if (direction && direction !== locale) return false;
          const needsTranslation = direction === locale || !pair.target.trim() || state[locale + ":" + pair.key]?.status === "outdated";
          return needsTranslation && !seen.current.has(locale + ":" + pair.key + ":" + textHash(pair.source));
        });
        if (changed.length) { void generate("translate", locale, changed.map(pair => pair.key)); break; }
      }
    }, 1500);
    return () => clearTimeout(timer);
    // UI changes do not start requests. One batch at a time shares the existing API limits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, automatic, available, busy, completed, batchBusy]);
  async function complete(action: "draft" | "translate") {
    if (pending.current || batchRunning.current) return;
    batchRunning.current = true; setBatchBusy(true);
    // The queue is fixed at click time. New user edits are protected by source/target snapshots.
    const queue = action === "translate" ? (["ar", "en"] as const).map(locale => ({ locale, keys: translationTasks(collection, current.current, baseline, metadata, reviewed).filter(task => task.locale === locale && task.reason !== "suggested").map(task => task.key) }))
      : [{ locale: draftLocale, keys: editableTextPairs(collection, current.current, draftLocale, activeFields.current.keys()).filter(pair => activeFields.current.has(pair.key) && !pair.source.trim() && !pair.target.trim()).map(pair => pair.key) }];
    try {
      for (const job of queue) {
        let remaining = [...job.keys];
        while (remaining.length && mounted.current) {
          const fields = assistanceBatch(editableTextPairs(collection, current.current, job.locale, remaining), remaining, action, brief);
          if (!fields.length) break;
          await generate(action, job.locale, fields.map(f => f.key), brief);
          remaining = remaining.filter(key => !fields.some(f => f.key === key));
        }
      }
    } finally { batchRunning.current = false; if (mounted.current) setBatchBusy(false); }
  }
  function acceptAll() {
    let next = current.current; const accepted: string[] = [];
    for (const [id, suggestion] of currentSuggestions) {
      if (!suggestionIsCurrent(suggestion, editableTextPairs(collection, next, suggestion.sourceLocale, [suggestion.key]))) continue;
      try { next = applyText(next, collection, suggestion.locale, suggestion.key, suggestion.text, suggestion.sourceLocale); accepted.push(id); } catch { /* A mismatched form structure remains editable manually. */ }
    }
    if (accepted.length) { onChange(next); onReview([...new Set([...reviewed, ...accepted.flatMap(id => [id, other(id.startsWith("ar:") ? "ar" : "en") + id.slice(2)])])]); setSuggestions(old => Object.fromEntries(Object.entries(old).filter(([id]) => !accepted.includes(id)))); }
  }
  async function compareLanguages() {
    if (pending.current || batchRunning.current || !available) return;
    batchRunning.current = true; pending.current = true; setBatchBusy(true); setReviewResult(null); setError("");
    const fields = pairs.ar.filter(pair => pair.source.trim() && pair.target.trim()).map(pair => ({ key: pair.key, ar: pair.source.trim(), en: pair.target.trim() }));
    const issues: NonNullable<Result["issues"]> = []; let checked = 0, skipped = 0;
    try {
      let remaining = [...fields];
      while (remaining.length && mounted.current) {
        let size = 0; const batch: typeof fields = [];
        while (remaining.length && batch.length < 20) {
          const field = remaining[0], length = field.ar.length + field.en.length;
          if (length > 12000) { remaining.shift(); skipped++; continue; }
          if (size + length > 12000) break;
          batch.push(remaining.shift()!); size += length;
        }
        if (!batch.length) continue;
        const result = await request("/api/admin/ai/review", { method: "POST", body: JSON.stringify({ collection, fields: batch }) });
        if (result.sourceHash !== reviewHash(batch)) throw new Error("Stale review");
        issues.push(...result.issues || []); checked += batch.length;
      }
      if (mounted.current) setReviewResult({ signature, issues, checked, skipped });
    } catch { if (mounted.current) setError(en ? "The language check could not finish. Review manually or retry." : "تعذر إتمام فحص اللغتين. راجع يدوياً أو أعد المحاولة."); }
    finally { pending.current = false; batchRunning.current = false; if (mounted.current) setBatchBusy(false); }
  }
  function dismiss(id: string) { setSuggestions(old => { const next = { ...old }; delete next[id]; return next; }); }
  function accept(id: string) {
    const suggestion = suggestions[id];
    if (!suggestion || !suggestionIsCurrent(suggestion, editableTextPairs(collection, current.current, suggestion.sourceLocale, [suggestion.key]))) return;
    try {
      // Acceptance is explicit; suggestions never replace either language on their own.
      onChange(applyText(current.current, collection, suggestion.locale, suggestion.key, suggestion.text, suggestion.sourceLocale), suggestion.sourceLocale + ":" + suggestion.key);
      dismiss(id);
    } catch { setError(en ? "Align the form fields first." : "وحّد ترتيب حقول النموذج أولاً."); }
  }
  return <Context.Provider value={{ collection, value, english: en, available, busy: busy || batchBusy, busyKeys, state, suggestions, change, generate, accept, dismiss,
    register, onChange, review: key => onReview([...new Set([...reviewed, "ar:" + key, "en:" + key])]),
    editSuggestion: (id, text) => setSuggestions(old => ({ ...old, [id]: { ...old[id], text } })),
  }}>
    <div className="bilingual-editor-note">
      <span><Languages size={18} />{en ? "Arabic & English together" : "العربية والإنجليزية في نفس المكان"}</span>
      {available ? <label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />{en ? "Suggest translations automatically" : "اقتراح ترجمة تلقائياً"}</label>
        : <small>{en ? "AI unavailable · both languages can be edited manually" : "المساعد غير متاح · يمكنك تحرير اللغتين يدوياً"}</small>}
      {busy && <span role="status"><LoaderCircle className="spin" size={15} />{en ? "Preparing suggestions…" : "جارٍ إعداد الاقتراحات…"}</span>}
    </div>
    <section className="record-ai-panel">
      <h3><Sparkles size={17} />{en ? "Complete & review this record" : "إكمال ومراجعة هذا السجل"}</h3>
      {available && <>
        {collection !== "policies" && collection !== "cohorts" && <><label className="structured-field"><span>{en ? "Facts for missing wording (optional)" : "حقائق لصياغة النصوص الناقصة (اختياري)"}</span><textarea rows={2} maxLength={1200} value={brief} onChange={e => setBrief(e.target.value)} placeholder={en ? "Paste approved facts to use for missing text. No personal or payment details." : "الصق الحقائق المعتمدة لصياغة النصوص الناقصة، دون بيانات شخصية أو مدفوعات."} /></label><div className="assistant-actions"><label>{en ? "Draft language " : "لغة الصياغة "}<select value={draftLocale} onChange={e => setDraftLocale(e.target.value as Locale)}><option value="ar">العربية</option><option value="en">English</option></select></label><button type="button" className="admin-secondary-button" disabled={busy || batchBusy || !brief.trim()} onClick={() => void complete("draft")}>{en ? "Suggest missing wording" : "اقتراح النصوص الناقصة"}</button></div></>}
        <div className="assistant-actions"><button type="button" className="admin-secondary-button" disabled={busy || batchBusy || !tasks.some(t => t.reason !== "suggested")} onClick={() => void complete("translate")}><Languages size={15} />{en ? "Complete missing / outdated translations" : "إكمال الترجمات الناقصة / القديمة"}</button><button type="button" className="admin-secondary-button" disabled={busy || batchBusy || !pairs.ar.some(pair => pair.source.trim() && pair.target.trim())} onClick={() => void compareLanguages()}>{en ? "Check Arabic / English meaning" : "فحص توافق المعنى باللغتين"}</button>{currentSuggestions.length > 0 && <button type="button" className="admin-secondary-button" disabled={busy || batchBusy} onClick={acceptAll}><Check size={15} />{en ? "Accept reviewed suggestions" : "قبول الاقتراحات بعد مراجعتها"}</button>}</div>
      </>}
      {batchBusy && <p role="status"><LoaderCircle size={15} className="spin" />{en ? "Preparing the record review…" : "جارٍ تجهيز مراجعة السجل…"}</p>}
      {reviewResult && reviewResult.signature === signature && <div className="translation-review-queue" role="status"><strong>{en ? "AI language check · advisory" : "فحص اللغتين بالمساعد · ملاحظات للمراجعة"}</strong><p>{en ? `${reviewResult.checked} fields checked. ${reviewResult.skipped} fields too long; review those manually.` : `تم فحص ${reviewResult.checked} حقول. ${reviewResult.skipped} حقول طويلة تحتاج مراجعة يدوية.`}</p>{reviewResult.issues.length ? <ul>{reviewResult.issues.map((issue, i) => <li key={i}><strong>{fieldLabel(issue.key)}</strong><span>{en ? issue.messageEn : issue.messageAr}</span></li>)}</ul> : <p>{en ? "No differences noticed in the checked fields. Confirm the facts yourself before publishing." : "لم يُلاحظ اختلاف في الحقول المفحوصة. أكد الحقائق بنفسك قبل النشر."}</p>}</div>}
      {currentSuggestions.length > 0 && <div className="admin-data-scroll"><table className="admin-data-table"><thead><tr><th>{en ? "Field" : "الحقل"}</th><th>{en ? "Current text" : "النص الحالي"}</th><th>{en ? "Suggestion" : "الاقتراح"}</th><th>{en ? "Action" : "الإجراء"}</th></tr></thead><tbody>{currentSuggestions.map(([id, s]) => <tr key={id}><td>{fieldLabel(s.key)} · {nameOf(s.locale)}</td><td>{String(getPath(value, localePath(collection, s.locale, s.key)) || "—")}</td><td><textarea aria-label={(en ? "Suggested " : "اقتراح ") + fieldLabel(s.key) + " " + nameOf(s.locale)} dir={s.locale === "ar" ? "rtl" : "ltr"} value={s.text} onChange={e => setSuggestions(old => ({ ...old, [id]: { ...s, text: e.target.value } }))} rows={2} /></td><td><button type="button" className="text-link" onClick={() => accept(id)}>{en ? "Accept" : "قبول"}</button> <button type="button" className="text-link" onClick={() => dismiss(id)}>{en ? "Dismiss" : "تجاهل"}</button></td></tr>)}</tbody></table></div>}
      <div className="translation-review-queue"><strong>{en ? "Before publishing" : "قبل النشر"}</strong>{!tasks.length ? <p>{en ? "No outstanding translation reviews." : "لا توجد ترجمات بانتظار المراجعة."}</p> : <ul>{tasks.map(task => <li key={task.key}><span>{fieldLabel(task.key)} · {task.reason === "missing" ? en ? "Translation missing" : "الترجمة ناقصة" : task.reason === "outdated" ? en ? "Source changed" : "تغير المصدر" : en ? "Review both languages" : "راجع اللغتين"}</span><button type="button" className="text-link" onClick={() => { const target = document.getElementsByName(localePath(collection, task.locale, task.key))[0]; target?.scrollIntoView({ behavior: "smooth", block: "center" }); target?.focus(); }}>{en ? "Go to field" : "انتقل للحقل"}</button>{task.reason !== "missing" && <button type="button" className="text-link" onClick={() => onReview([...new Set([...reviewed, "ar:" + task.key, "en:" + task.key])])}>{en ? "I reviewed both languages" : "راجعت اللغتين"}</button>}</li>)}</ul>}</div>
    </section>
    {error && <p role="alert" className="form-error bilingual-editor-error">{error}</p>}
    {children}
  </Context.Provider>;
}

export function BilingualField({ fieldKey, label, multiline = false, list = false, required = false, errors = [] }: {
  fieldKey: string; label: string; multiline?: boolean; list?: boolean; required?: boolean; errors?: Array<{ path: Array<string | number>; message: string }>;
}) {
  const context = useContext(Context);
  if (!context) throw new Error("BilingualField needs ContentAssistant");
  const { value, collection, english: en, onChange } = context;
  const ar = getPath(value, localePath(collection, "ar", fieldKey)), english = getPath(value, localePath(collection, "en", fieldKey));
  if (!list || typeof ar === "string" || typeof english === "string") return <BilingualText fieldKey={fieldKey} label={label} multiline={multiline || list} required={required} errors={errors} />;
  const count = Math.max(Array.isArray(ar) ? ar.length : 0, Array.isArray(english) ? english.length : 0);
  function add() {
    let next = value;
    for (const locale of ["ar", "en"] as const) {
      const raw = getPath(value, localePath(collection, locale, fieldKey)), items = Array.isArray(raw) ? [...raw] : [];
      while (items.length < count) items.push("");
      next = setPath(next, localePath(collection, locale, fieldKey), [...items, ""]);
    }
    onChange(next);
  }
  return <section className="bilingual-list"><h3>{label}{required ? " *" : ""}</h3>{Array.from({ length: count }, (_, index) => <div className="bilingual-list-item" key={index}>
    <BilingualText fieldKey={fieldKey + "." + index} label={(en ? "Item " : "البند ") + (index + 1)} multiline errors={errors} />
    <button type="button" className="admin-icon-button danger" aria-label={(en ? "Remove item " : "إزالة البند ") + (index + 1)} onClick={() => {
      let next = value;
      for (const locale of ["ar", "en"] as const) { const raw = getPath(value, localePath(collection, locale, fieldKey)); next = setPath(next, localePath(collection, locale, fieldKey), Array.isArray(raw) ? raw.filter((_, i) => i !== index) : []); }
      onChange(next);
    }}><Trash2 size={14} /></button>
  </div>)}<button type="button" className="admin-secondary-button" onClick={add}><Plus size={14} />{en ? "Add item" : "إضافة بند"}</button></section>;
}
function BilingualText({ fieldKey, label, multiline, required, errors }: { fieldKey: string; label: string; multiline?: boolean; required?: boolean; errors: Array<{ path: Array<string | number>; message: string }> }) {
  const context = useContext(Context)!;
  const { value, collection, english: en, state, suggestions } = context;
  const [briefLocale, setBriefLocale] = useState<Locale | null>(null), [brief, setBrief] = useState("");
  useEffect(() => context.register(fieldKey), [fieldKey]); // registration follows the visible editor fields
  const ar = String(getPath(value, localePath(collection, "ar", fieldKey)) ?? ""), english = String(getPath(value, localePath(collection, "en", fieldKey)) ?? "");
  const valid = (id: string) => suggestions[id] && suggestionIsCurrent(suggestions[id], editableTextPairs(collection, value, suggestions[id].sourceLocale, [fieldKey]));
  const statuses = [state["ar:" + fieldKey]?.status, state["en:" + fieldKey]?.status];
  const status = valid("ar:" + fieldKey) || valid("en:" + fieldKey) ? "suggested" : ar.trim() && !english.trim() || english.trim() && !ar.trim() ? "missing" : statuses.includes("outdated") ? "outdated" : statuses.includes("suggested") ? "suggested" : ar.trim() && english.trim() ? "reviewed" : null;
  return <section className="bilingual-field" aria-label={label}>
    <div className="bilingual-field-heading"><strong>{label}{required ? " *" : ""}</strong>{status && <span className={"translation-status translation-status--" + status}>{({ missing: en ? "Translation missing" : "الترجمة ناقصة", suggested: en ? "Review wording" : "تحتاج مراجعة", outdated: en ? "Source changed" : "تغير النص الأصلي", reviewed: en ? "Reviewed" : "تمت المراجعة" })[status]}</span>}</div>
    <div className="bilingual-columns">{(["ar", "en"] as const).map(locale => {
      const text = locale === "ar" ? ar : english, path = localePath(collection, locale, fieldKey), id = locale + ":" + fieldKey;
      const issues = errors.filter(issue => issue.path.join(".") === path), suggestion = suggestions[id], hasSuggestion = valid(id);
      return <div className="bilingual-language" key={locale} lang={locale}>
        <label className="structured-field"><span>{nameOf(locale)}</span>{multiline
          ? <textarea name={path} dir={locale === "ar" ? "rtl" : "ltr"} value={text} rows={3} aria-label={label + " — " + nameOf(locale)} aria-invalid={issues.length ? true : undefined} onChange={event => context.change(fieldKey, locale, event.target.value)} />
          : <input name={path} dir={locale === "ar" ? "rtl" : "ltr"} value={text} aria-label={label + " — " + nameOf(locale)} aria-invalid={issues.length ? true : undefined} onChange={event => context.change(fieldKey, locale, event.target.value)} />}
          {issues.map((issue, index) => <small className="field-error" key={index}>{issue.message}</small>)}
        </label>
        {context.available && <div className="inline-ai-actions" aria-label={(en ? "Text assistance: " : "مساعدة النص: ") + nameOf(locale)}>
          {collection !== "policies" && <button type="button" disabled={context.busy} onClick={() => { setBriefLocale(briefLocale === locale ? null : locale); setBrief(""); }}><Sparkles size={12} />{en ? "Draft" : "صياغة"}</button>}
          <button type="button" disabled={context.busy || !text.trim()} onClick={() => void context.generate("improve", locale, [fieldKey])}>{en ? "Improve" : "تحسين"}</button>
          {collection !== "policies" && <button type="button" disabled={context.busy || !text.trim()} onClick={() => void context.generate("shorten", locale, [fieldKey])}>{en ? "Shorten" : "اختصار"}</button>}
          <button type="button" disabled={context.busy || !text.trim()} onClick={() => void context.generate("translate", locale, [fieldKey])}><Languages size={12} />{en ? "To " : "إلى "}{nameOf(other(locale))}</button>
        </div>}
        {briefLocale === locale && <div className="inline-ai-brief"><label className="structured-field"><span>{en ? "Facts to include" : "الحقائق المطلوب تضمينها"}</span><textarea rows={2} maxLength={1200} value={brief} onChange={event => setBrief(event.target.value)} /></label><button className="admin-secondary-button" type="button" disabled={context.busy || !brief.trim()} onClick={() => { void context.generate("draft", locale, [fieldKey], brief); setBriefLocale(null); }}>{en ? "Suggest wording" : "اقتراح صياغة"}</button></div>}
        {hasSuggestion && <div className="ai-suggestion inline-ai-suggestion"><label className="structured-field"><span><Sparkles size={13} />{en ? "Suggested wording · edit before accepting" : "نص مقترح · يمكنك تعديله قبل القبول"}</span><textarea dir={locale === "ar" ? "rtl" : "ltr"} aria-label={(en ? "Suggestion: " : "اقتراح: ") + label + " — " + nameOf(locale)} rows={3} value={suggestion.text} onChange={event => context.editSuggestion(id, event.target.value)} /></label><div className="assistant-actions"><button type="button" className="admin-secondary-button" onClick={() => context.accept(id)}><Check size={14} />{en ? "Accept" : "قبول"}</button><button type="button" className="admin-secondary-button" onClick={() => context.dismiss(id)}><X size={14} />{en ? "Dismiss" : "تجاهل"}</button></div></div>}
      </div>;
    })}</div>
    {status && status !== "reviewed" && ar.trim() && english.trim() && <button type="button" className="text-link bilingual-review" onClick={() => context.review(fieldKey)}><Check size={13} />{en ? "I reviewed both languages" : "راجعت النص في اللغتين"}</button>}
    {context.busyKeys.includes(fieldKey) && <small role="status" className="inline-ai-progress"><LoaderCircle size={13} className="spin" />{en ? "Preparing a suggestion for this field…" : "جارٍ إعداد اقتراح لهذا الحقل…"}</small>}
  </section>;
}
