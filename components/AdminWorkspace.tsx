"use client";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap, Globe, ImagePlus, Inbox, LayoutDashboard, LoaderCircle, LogOut, Settings, ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { adminLanguageHref } from "@/lib/admin/navigation";
import { AdminLanguageToggle } from "./AdminLanguageToggle";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { statusLabel } from "@/lib/admin/records";
import { workAreas, contentResources } from "@/lib/admin/content";
import { AdminTeamManager } from "./AdminTeamManager";
import { AdminContentManager } from "./AdminContentManager";
import { TrainingAdmin } from "./TrainingAdmin";
type Session = { role: string; resources: string[]; areas: string[]; aiAvailable: boolean };
const icons = { overview: LayoutDashboard, training: GraduationCap, inbox: Inbox, website: Globe, media: ImagePlus, settings: Settings };
export function AdminWorkspace() {
  const en = useLocale() === "en";
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null), [session, setSession] = useState<Session | null>(null), [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [area, setArea] = useState("overview"), [tab, setTab] = useState(""), [dirty, setDirty] = useState(false);
  const [metrics, setMetrics] = useState<Array<{ key: string; count: number | null }>>([]), [setup, setSetup] = useState<Record<string, any> | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; collection: string; titleAr: string; titleEn: string; status: string; at: string }>>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const dirtyRef = useRef(false), locationRef = useRef(""); dirtyRef.current = dirty;
  const permitted = useMemo(() => contentResources.filter(([id]) => session?.resources.includes(id)), [session]);
  const tabs = permitted.filter(([, , , parent]) => parent === area);
  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!user) throw new Error(en ? "Sign in first" : "سجّل الدخول أولاً");
    const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken(), ...init.headers } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || (en ? "Request failed" : "تعذر إتمام الطلب")), { details: result.details || [] });
    return result;
  }, [user, en]);
  useEffect(() => { if (!isFirebaseClientConfigured()) { setAuthReady(true); return; } return onAuthStateChanged(getFirebaseAuth(), next => { setUser(next); setSession(null); setAuthReady(true); setDirty(false); }); }, []);
  useEffect(() => {
    if (!user) return; let active = true;
    request("/api/admin/session").then(result => { if (active) { setSession(result); setError(""); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [user, request]);
  useEffect(() => {
    if (!session) return;
    function restore() {
      if (locationRef.current && dirtyRef.current && !window.confirm(en ? "Discard unsaved changes?" : "تجاهل التعديلات غير المحفوظة؟")) { history.pushState(null, "", locationRef.current); return; }
      const params = new URLSearchParams(location.search), requested = params.get("area") || "overview";
      const nextArea = session!.areas.includes(requested) ? requested : "overview";
      const allowed = contentResources.filter(([id, , , group]) => group === nextArea && session!.resources.includes(id));
      setArea(nextArea); setTab(allowed.find(([id]) => id === params.get("tab"))?.[0] || allowed[0]?.[0] || ""); setDirty(false); locationRef.current = location.href;
    }
    restore(); window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);
  }, [session, en]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, []);
  const canLeave = () => !dirtyRef.current || window.confirm(en ? "Discard unsaved changes?" : "تجاهل التعديلات غير المحفوظة؟");
  function switchLanguage() {
    if (!canLeave()) return;
    dirtyRef.current = false; setDirty(false);
    router.replace(adminLanguageHref(location.search, location.hash), { locale: en ? "ar" : "en", scroll: false });
  }
  const languageToggle = <AdminLanguageToggle english={en} onSwitch={switchLanguage} />;
  function navigate(nextArea: string, requestedTab?: string, itemId?: string) {
    if (!canLeave()) return;
    const nextTab = requestedTab || permitted.find(([, , , group]) => group === nextArea)?.[0] || "";
    const url = new URL(location.href); url.searchParams.set("area", nextArea); if (itemId) url.searchParams.set("item", itemId); else url.searchParams.delete("item"); if (nextTab) url.searchParams.set("tab", nextTab); else url.searchParams.delete("tab");
    history.pushState(null, "", url); locationRef.current = url.href; setArea(nextArea); setTab(nextTab); setDirty(false); setError("");
  }
  useEffect(() => {
    if (!session) return; let active = true;
    if (area === "overview") { setOverviewLoading(true); request("/api/admin/overview").then(r => { if (active) { setMetrics(r.metrics || []); setRecent(r.recent || []); } }).catch(() => { if (active) setError(en ? "Could not load the overview. Choose a work area to continue." : "تعذر تحميل الملخص. اختر مساحة عمل للمتابعة."); }).finally(() => { if (active) setOverviewLoading(false); }); }
    if (tab === "diagnostics") request("/api/admin/training?setup=true").then(r => { if (active) setSetup(r); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [area, tab, session, request, en]);
  if (!isFirebaseClientConfigured()) return <section className="admin-shell"><div className="admin-login__language">{languageToggle}</div><p role="alert">{en ? "Administration is not configured yet." : "لم تُجهز لوحة الإدارة بعد."}</p></section>;
  if (!authReady) return <section className="admin-login"><div className="admin-login__card"><div className="admin-login__language">{languageToggle}</div><h1>{en ? "SEA administration" : "إدارة الأكاديمية"}</h1><LoaderCircle className="spin" aria-label={en ? "Loading" : "جارٍ التحميل"} /></div></section>;
  if (!user) return <section className="admin-login"><div className="admin-login__card"><div className="admin-login__language">{languageToggle}</div><span className="admin-brand"><ShieldCheck size={24} /></span><h1>{en ? "SEA administration" : "إدارة الأكاديمية"}</h1><p>{en ? "Sign in to manage training and website content." : "سجّل الدخول لإدارة التدريب ومحتوى الموقع."}</p><form className="admin-login__form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password); setPassword(""); } catch { setError(en ? "Check your email and password, then retry." : "تحقق من البريد وكلمة المرور وأعد المحاولة."); } finally { setBusy(false); } }}><label>{en ? "Email" : "البريد الإلكتروني"}<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>{en ? "Password" : "كلمة المرور"}<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button button--primary" disabled={busy}>{busy && <LoaderCircle className="spin" size={16} />}{en ? "Sign in" : "دخول"}</button></form></div></section>;
  return <section className="admin-shell admin-console"><header className="admin-topbar"><div className="admin-topbar__brand"><span className="admin-brand"><ShieldCheck size={24} /></span><div><h1>{en ? "SEA workspace" : "مساحة عمل الأكاديمية"}</h1><p>{en ? "Training, content and communication" : "التدريب والمحتوى والتواصل"}</p></div></div><div className="admin-topbar__actions">{languageToggle}<button className="admin-secondary-button" onClick={async () => { if (canLeave()) await signOut(getFirebaseAuth()); }}><LogOut size={16} />{en ? "Sign out" : "خروج"}</button></div></header>
    {!session ? <div className="admin-empty">{error ? <p role="alert">{error}</p> : <LoaderCircle className="spin" />}</div> : <div className="admin-workspace"><aside className="admin-sidebar" aria-label={en ? "Work areas" : "مساحات العمل"}>{workAreas.filter(v => session.areas.includes(v.id)).map(item => { const Icon = icons[item.id]; return <button type="button" className={"admin-nav-item " + (area === item.id ? "is-active" : "")} key={item.id} aria-current={area === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><Icon size={19} /><span>{en ? item.en : item.ar}</span></button>; })}</aside>
    <div className="admin-main"><div className="workspace-title"><h2>{workAreas.find(v => v.id === area)?.[en ? "en" : "ar"]}</h2><span className="workspace-save-state">{dirty ? en ? "Unsaved changes" : "تعديلات غير محفوظة" : en ? "Up to date" : "محدّث"}</span></div>
      {tabs.length > 0 && <nav className="workspace-tabs" aria-label={en ? "Sections" : "الأقسام"}>{tabs.map(([id, ar, english]) => <button type="button" aria-current={tab === id ? "page" : undefined} className={tab === id ? "is-active" : ""} onClick={() => navigate(area, id)} key={id}>{en ? english : ar}</button>)}</nav>}
      {error && <div className="admin-error" role="alert">{error}</div>}
      {area === "overview" ? <><div className="overview-grid">{metrics.map(metric => <button type="button" className="overview-card" key={metric.key} onClick={() => { const resource = permitted.find(([id]) => id === metric.key); if (resource) navigate(resource[3], resource[0]); }}><span>{({ programs: en ? "Published programs" : "برامج منشورة", courses: en ? "Published courses" : "دورات منشورة", applications: en ? "New applications" : "طلبات اهتمام جديدة", employer_inquiries: en ? "New employer inquiries" : "طلبات منشآت جديدة", contact_inquiries: en ? "New messages" : "رسائل جديدة", pages: en ? "Published pages" : "صفحات منشورة", media: en ? "Media assets" : "ملفات وسائط", cohorts: en ? "Published cohorts" : "دفعات منشورة", bookings: en ? "Confirmed bookings" : "حجوزات مؤكدة" })[metric.key]}</span><strong>{metric.count ?? "—"}</strong></button>)}</div><section className="admin-data-panel overview-recent"><div className="admin-data-heading"><h3>{en ? "Recent work & incoming requests" : "آخر التحديثات والطلبات الواردة"}</h3></div><div className="admin-data-scroll"><table className="admin-data-table"><thead><tr><th>{en ? "Content / request" : "المحتوى / الطلب"}</th><th>{en ? "Section" : "القسم"}</th><th>{en ? "Status" : "الحالة"}</th><th>{en ? "Updated" : "آخر تحديث"}</th><th>{en ? "Action" : "الإجراء"}</th></tr></thead><tbody>{recent.map(item => <tr key={item.collection + item.id}><td><strong>{en ? item.titleEn : item.titleAr}</strong></td><td>{contentResources.find(([id]) => id === item.collection)?.[en ? 2 : 1]}</td><td><span className="admin-table-status">{statusLabel(item.status, en)}</span></td><td>{item.at && Number.isFinite(Date.parse(item.at)) ? new Intl.DateTimeFormat(en ? "en-GB" : "ar-SA", { dateStyle: "medium", calendar: "gregory" }).format(new Date(item.at)) : "—"}</td><td><button type="button" className="admin-secondary-button" onClick={() => { const resource = permitted.find(([id]) => id === item.collection); if (resource) navigate(resource[3], resource[0], item.id); }}>{en ? "Open" : "فتح"}</button></td></tr>)}{!recent.length && <tr><td colSpan={5} className="admin-data-empty">{overviewLoading ? en ? "Loading recent work…" : "جارٍ تحميل آخر التحديثات…" : en ? "Your latest content and requests will appear here automatically." : "ستظهر أحدث سجلات المحتوى والطلبات هنا تلقائياً."}</td></tr>}</tbody></table></div></section></>
      : ["cohorts", "bookings", "payments"].includes(tab) ? <TrainingAdmin key={tab + (en ? ":en" : ":ar")} user={user} english={en} activeTab={tab} onDirtyChange={setDirty} aiAvailable={session.aiAvailable} />
      : tab === "team" ? <AdminTeamManager authUser={user} english={en} />
      : tab === "diagnostics" ? <section className="content-panel"><h3>{en ? "Service readiness" : "جاهزية الخدمات"}</h3>{setup ? <><p>{setup.bookingReady ? en ? "Booking is ready." : "الحجز جاهز." : en ? "Booking needs configuration." : "يحتاج الحجز إلى إعداد."}</p><p>{session.aiAvailable ? en ? "Gemini is connected." : "Gemini متصل." : en ? "Gemini is not configured; manual editing is available." : "لم يُضبط Gemini؛ التحرير اليدوي متاح."}</p><ul>{(Array.isArray(setup.missing) ? setup.missing : []).map((key: string) => <li key={key}><code>{key}</code></li>)}</ul><p>{setup.demo ? en ? "Sandbox deployment" : "بيئة تجريبية" : en ? "Live deployment" : "بيئة تشغيل"}</p></> : <LoaderCircle className="spin" />}</section>
      : <AdminContentManager key={tab + (en ? ":en" : ":ar")} collection={tab} english={en} aiAvailable={session.aiAvailable} request={request} onDirtyChange={setDirty} />}
    </div></div>}
  </section>;
}
