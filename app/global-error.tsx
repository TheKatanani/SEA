"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("SEA global application error", error);
  }, [error]);

  const english = typeof window !== "undefined" && window.location.pathname.startsWith("/en");
  return <html lang={english ? "en" : "ar"} dir={english ? "ltr" : "rtl"}><body style={{ margin: 0, background: "#fbfaf7", color: "#10243e", fontFamily: "Arial, sans-serif" }}>
    <main role="alert" style={{ minHeight: "100vh", display: "grid", placeContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
      <span style={{ color: "#087180", fontWeight: 700, letterSpacing: ".08em" }}>SEA</span>
      <h1 style={{ margin: 0, fontSize: "clamp(26px, 5vw, 42px)" }}>{english ? "The Academy website encountered a problem" : "واجه موقع الأكاديمية مشكلة"}</h1>
      <p style={{ maxWidth: 560, margin: "0 auto", color: "#66727d", lineHeight: 1.8 }}>{english ? "Please try again. If the issue continues, return to the home page." : "يرجى المحاولة مجددًا. إذا استمرت المشكلة، عُد إلى الصفحة الرئيسية."}</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={reset} style={{ border: 0, borderRadius: 999, padding: "12px 22px", background: "#087180", color: "white", font: "inherit", fontWeight: 700, cursor: "pointer" }}>{english ? "Try again" : "حاول مجددًا"}</button>
        <a href={english ? "/en" : "/"} style={{ borderRadius: 999, padding: "12px 22px", background: "white", color: "#10243e", textDecoration: "none", fontWeight: 700 }}>{english ? "Home" : "الرئيسية"}</a>
      </div>
    </main>
  </body></html>;
}
