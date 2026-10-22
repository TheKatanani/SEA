"use client";
import { useState } from "react";
export function ContentVersions({ collection, id, english, request, restored }: { collection: string; id: string; english: boolean; request: (url: string, init?: RequestInit) => Promise<{ items?: Array<{ id: string; at: string }> }>; restored: () => void }) {
  const [versions, setVersions] = useState<Array<{ id: string; at: string }>>([]); const [error, setError] = useState("");
  async function load() { try { setVersions((await request("/api/admin/versions?" + new URLSearchParams({ collection, id }))).items || []); } catch { setError(english ? "Could not load history." : "تعذر تحميل الإصدارات."); } }
  async function restore(versionId: string) {
    try { await request("/api/admin/versions", { method: "POST", body: JSON.stringify({ versionId }) }); restored(); }
    catch { setError(english ? "Could not restore this version." : "تعذر استعادة الإصدار."); }
  }
  return <details className="content-panel" onToggle={(e) => { if (e.currentTarget.open) void load(); }}><summary>{english ? "Earlier versions" : "الإصدارات السابقة"}</summary>{error && <p role="alert">{error}</p>}{versions.map((v) => <p key={v.id}><time>{v.at ? new Date(v.at).toLocaleString(english ? "en" : "ar") : v.id}</time> <button type="button" onClick={() => void restore(v.id)}>{english ? "Restore as draft" : "استعادة كمسودة"}</button></p>)}{!versions.length && <p>{english ? "No earlier versions." : "لا توجد إصدارات سابقة."}</p>}</details>;
}

