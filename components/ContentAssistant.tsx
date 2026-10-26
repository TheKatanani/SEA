"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sparkles, Languages, Check, X, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { allowedTextPath, applyText, buildTranslationState, getPath, localePath, setPath, textHash, textPairs, type ContentRecord, type Locale, type TranslationState } from "@/lib/admin/content";
import { assistanceBatch, editableTextPairs, suggestionIsCurrent } from "@/lib/admin/assistance";

type Action = "draft" | "improve" | "shorten" | "translate";
type Suggestion = { key: string; text: string; sourceHash: string; sourceText: string; sourceLocale: Locale; locale: Locale };
type Result = { fields?: Array<{ key: string; text: string; sourceHash: string }> };
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
  const current = useRef(value), mounted = useRef(true), pending = useRef(false);
  const seen = useRef(new Set<string>()), cache = useRef(new Map<string, Suggestion[]>());
  const activeFields = useRef(new Map<string, number>()), directions = useRef(new Map<string, Locale>());
  current.current = value;
  const state = useMemo(() => buildTranslationState(collection, value, baseline, metadata, reviewed), [collection, value, baseline, metadata, reviewed]);
  const pairs = useMemo(() => ({ ar: textPairs(collection, value, "ar"), en: textPairs(collection, value, "en") }), [collection, value]);
  const signature = JSON.stringify([pairs.ar, pairs.en]);
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
    if (!available || !automatic || busy) return;
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
  }, [signature, automatic, available, busy, completed]);
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
  return <Context.Provider value={{ collection, value, english: en, available, busy, busyKeys, state, suggestions, change, generate, accept, dismiss,
    register, onChange, review: key => onReview([...new Set([...reviewed, "ar:" + key, "en:" + key])]),
    editSuggestion: (id, text) => setSuggestions(old => ({ ...old, [id]: { ...old[id], text } })),
  }}>
    <div className="bilingual-editor-note">
      <span><Languages size={18} />{en ? "Arabic & English together" : "العربية والإنجليزية في نفس المكان"}</span>
      {available ? <label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />{en ? "Suggest translations automatically" : "اقتراح ترجمة تلقائياً"}</label>
        : <small>{en ? "AI unavailable · both languages can be edited manually" : "المساعد غير متاح · يمكنك تحرير اللغتين يدوياً"}</small>}
      {busy && <span role="status"><LoaderCircle className="spin" size={15} />{en ? "Preparing suggestions…" : "جارٍ إعداد الاقتراحات…"}</span>}
    </div>
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
