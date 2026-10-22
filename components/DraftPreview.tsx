"use client";
export function DraftPreview({ record, english }: { record: Record<string, unknown>; english: boolean }) {
  const locales = record.locales as Record<string, Record<string, unknown>> | undefined;
  const text = locales?.[english ? "en" : "ar"];
  if (!text) return <p>{english ? "No translation available." : "لا توجد ترجمة متاحة."}</p>;
  const sections = Array.isArray(text.sections) ? text.sections as Record<string, unknown>[] : [];
  return <details className="content-panel"><summary>{english ? "Preview draft text (private)" : "معاينة نص المسودة (خاصة)"}</summary><article><h2>{String(text.title || "")}</h2><p>{String(text.description || text.summary || "")}</p>{sections.map((s, i) => <section key={i}><h3>{String(s.heading || "")}</h3><p style={{ whiteSpace: "pre-wrap" }}>{String(s.body || "")}</p>{typeof s.type === "string" && s.type !== "text" && <small>{english ? "Linked content: " : "محتوى مرتبط: "}{String(s.collection || s.formType || "")}</small>}</section>)}</article></details>;
}

