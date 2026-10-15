"use client";

import { useEffect } from "react";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("SEA route error", error);
  }, [error]);

  const english = typeof window !== "undefined" && window.location.pathname.startsWith("/en");
  return <main className="cms-state page-shell" role="alert">
    <span className="eyebrow"><span className="eyebrow__dot" />SEA</span>
    <h1>{english ? "This page could not be loaded" : "تعذر تحميل هذه الصفحة"}</h1>
    <p>{english ? "A temporary problem occurred. Try again, or return to the home page." : "حدثت مشكلة مؤقتة. حاول مرة أخرى أو عُد إلى الصفحة الرئيسية."}</p>
    <div className="button-row">
      <button className="button button--primary" type="button" onClick={reset}>{english ? "Try again" : "حاول مجددًا"}</button>
      <a className="button button--light" href={english ? "/en" : "/"}>{english ? "Home" : "الرئيسية"}</a>
    </div>
  </main>;
}
