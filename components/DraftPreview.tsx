"use client";
export function DraftPreview({ record, english, expanded = false }: { record: Record<string, unknown>; english: boolean; expanded?: boolean }) {
  const locales = record.locales as Record<string, Record<string, unknown>> | undefined;
  const text = locales?.[english ? "en" : "ar"];
  if (!text) return <p>{english ? "No translation available." : "لا توجد ترجمة متاحة."}</p>;
  const sections = Array.isArray(text.sections) ? text.sections as Record<string, unknown>[] : [];
  const content = <article dir={english ? "ltr" : "rtl"} className="draft-preview"><h3>{String(text.title || text.question || "")}</h3>{["description", "summary", "body", "answer", "targetAudience", "outcomes", "careers"].map(key => typeof text[key] === "string" && text[key] ? <p key={key} style={{ whiteSpace: "pre-wrap" }}>{String(text[key])}</p> : null)}{["requirements", "documents", "pillars"].map(key => Array.isArray(text[key]) && (text[key] as unknown[]).some(Boolean) ? <ul key={key}>{(text[key] as unknown[]).filter(Boolean).map((v, i) => <li key={i}>{String(v)}</li>)}</ul> : null)}{sections.map((s, i) => <section key={i}>{s.heading ? <h4>{String(s.heading)}</h4> : null}{s.body ? <p style={{ whiteSpace: "pre-wrap" }}>{String(s.body)}</p> : null}{typeof s.type === "string" && s.type !== "text" && <small>{english ? "Linked content" : "محتوى مرتبط"}</small>}</section>)}{Array.isArray(text.fields) && <dl>{(text.fields as Array<Record<string, unknown>>).map((f, i) => <div key={i}><dt>{String(f.label || "")}</dt><dd>{String(f.placeholder || "")}{Array.isArray(f.options) ? f.options.join(" / ") : ""}</dd></div>)}</dl>}</article>;
  return expanded ? content : <details className="content-panel"><summary>{english ? "Preview draft text (private)" : "معاينة نص المسودة (خاصة)"}</summary>{content}</details>;
}

