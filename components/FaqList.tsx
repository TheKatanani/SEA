"use client";

import { ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

type Faq = { id: string; locales?: Record<string, { question?: string; answer?: string }>; question?: string; answer?: string };

export function FaqList() {
  const english = useLocale() === "en";
  const [items, setItems] = useState<Faq[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site/content?collection=faqs", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => setItems(Array.isArray(result?.items) ? result.items : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="faq-list">
      {items.filter((item) => item.locales?.[english ? "en" : "ar"]?.question || item.question).map((item, index) => {
        const translation = item.locales?.[english ? "en" : "ar"];
        return <details className="faq-item" key={item.id} open={index === 0}>
          <summary><span>{translation?.question || item.question}</span><ChevronDown size={18} aria-hidden="true" /></summary>
          <p>{translation?.answer || item.answer}</p>
        </details>
      })}
      {!items.length && <p className="content-empty">{english ? "No questions have been published yet." : "لم تُنشر أسئلة شائعة بعد."}</p>}
    </div>
  );
}
