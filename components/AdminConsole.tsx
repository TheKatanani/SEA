"use client";

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Check, ChevronRight, CircleAlert, CloudUpload, Database, Eye, FileText, ImagePlus, LoaderCircle, LogOut, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { AdminRecordFields } from "@/components/AdminRecordFields";
import { AdminTeamManager } from "@/components/AdminTeamManager";

type Resource = { id: string; [key: string]: unknown };
const resources = [
  { id: "applications", ar: "طلبات التسجيل", en: "Applications", group: "inbox" },
  { id: "employer_inquiries", ar: "طلبات المنشآت", en: "Employer inquiries", group: "inbox" },
  { id: "contact_inquiries", ar: "رسائل التواصل", en: "Contact messages", group: "inbox" },
  { id: "pages", ar: "صفحات الموقع", en: "Site pages", group: "site" },
  { id: "programs", ar: "البرامج", en: "Programs", group: "site" },
  { id: "courses", ar: "الدورات", en: "Courses", group: "site" },
  { id: "news", ar: "الأخبار", en: "News", group: "site" },
  { id: "calendar", ar: "التقويم", en: "Calendar", group: "site" },
  { id: "gallery", ar: "المعرض", en: "Gallery", group: "site" },
  { id: "partners", ar: "الشركاء", en: "Partners", group: "site" },
  { id: "admissions", ar: "شروط القبول", en: "Admission content", group: "site" },
  { id: "resources", ar: "الموارد والوثائق", en: "Resources and documents", group: "site" },
  { id: "forms", ar: "النماذج والحقول", en: "Forms and fields", group: "site" },
  { id: "faqs", ar: "الأسئلة الشائعة", en: "FAQs", group: "site" },
  { id: "policies", ar: "السياسات", en: "Policies", group: "site" },
  { id: "support", ar: "الدعم والأدلة", en: "Support and guides", group: "site" },
  { id: "brand", ar: "الهوية والعلامة", en: "Brand settings", group: "settings" },
  { id: "settings", ar: "إعدادات الموقع", en: "Site settings", group: "settings" },
  { id: "media", ar: "مكتبة الوسائط", en: "Media library", group: "settings" },
  { id: "audit_logs", ar: "سجل التعديلات", en: "Change history", group: "settings" },
  { id: "team", ar: "المستخدمون والصلاحيات", en: "Team access", group: "settings" },
] as const;

const pagePaths = ["/", "/about", "/programs", "/admission", "/apply", "/employers", "/gallery", "/accreditation", "/accreditation/academie-paris", "/partners", "/partners/cote-dazur", "/student-journey", "/policies", "/support", "/contact", "/news", "/academic-calendar", "/faq", "/careers", "/campaigns/future-diploma"];

function starterRecord(collection: string): Resource {
  const id = `${collection}-${Date.now().toString(36)}`;
  const title = { ar: "سجل جديد", en: "New record" };
  const description = { ar: "أضف وصفًا واضحًا لهذا السجل.", en: "Add a clear description for this record." };
  if (collection === "pages") return { id, path: "/new-page", status: "draft", locales: { ar: { title: "صفحة جديدة", description: "أضف وصف الصفحة هنا.", sections: [] }, en: { title: "New page", description: "Add the page description here.", sections: [] } } };
  if (collection === "brand") return { id: "main", status: "draft", logoUrl: "", footerLogoUrl: "", faviconUrl: "", primaryColor: "#087180", accentColor: "#f1a52d", fontArabic: "IBM Plex Sans Arabic", fontEnglish: "Montserrat", socialLinks: {}, contact: {}, navigation: [], footerLinks: [] };
  if (collection === "admissions") return { id, status: "draft", locales: { ar: { requirements: ["أضف شرط قبول"], documents: ["أضف وثيقة مطلوبة"] }, en: { requirements: ["Add an admission requirement"], documents: ["Add a required document"] } } };
  if (collection === "forms") return { id, status: "draft", formType: "custom_form", locales: { ar: { title: "نموذج جديد", description: "أضف وصف النموذج.", buttonLabel: "إرسال", fields: [{ name: "new_field", label: "حقل جديد", type: "text", required: false }] }, en: { title: "New form", description: "Add a description for this form.", buttonLabel: "Submit", fields: [{ name: "new_field", label: "New field", type: "text", required: false }] } } };
  if (collection === "faqs") return { id, status: "draft", locales: { ar: { question: "أضف السؤال هنا.", answer: "أضف الإجابة هنا." }, en: { question: "Add the question here.", answer: "Add the answer here." } } };
  if (collection === "gallery") return { id, status: "draft", type: "photo", locales: { ar: { title: "صورة جديدة", caption: "أضف تعليق الصورة.", alt: "أضف وصفًا للصورة" }, en: { title: "New photo", caption: "Add a caption.", alt: "Add an image description" } } };
  if (["programs", "courses", "news"].includes(collection)) return { id, status: "draft", locales: { ar: { title: title.ar, description: description.ar, ...(collection === "news" ? { body: "اكتب تفاصيل الخبر هنا." } : {}) }, en: { title: title.en, description: description.en, ...(collection === "news" ? { body: "Write the news details here." } : {}) } } };
  if (collection === "calendar") return { id, status: "draft", locales: { ar: { title: "فعالية جديدة" }, en: { title: "New calendar item" } } };
  if (collection === "resources") return { id, status: "draft", format: "PDF", locales: { ar: { title: "وثيقة جديدة", category: "الموارد" }, en: { title: "New document", category: "Resources" } } };
  if (collection === "partners") return { id, status: "draft", locales: { ar: { title: "شريك جديد", group: "الشركاء" }, en: { title: "New partner", group: "Partners" } } };
  if (["policies", "support"].includes(collection)) return { id, status: "draft", locales: { ar: { title: "محتوى جديد", summary: description.ar, sections: [] }, en: { title: "New content", summary: description.en, sections: [] } } };
  return { id, status: "draft", locales: { ar: { title: title.ar, description: description.ar }, en: { title: title.en, description: description.en } } };
}

function resourceName(id: string, english: boolean) {
  const item = resources.find((resource) => resource.id === id);
  return item ? english ? item.en : item.ar : id;
}

function itemName(item: Resource, collection: string, english: boolean) {
  const localized = (item.locales as Record<string, { title?: string }> | undefined)?.[english ? "en" : "ar"]?.title;
  const fields = item.fields as Record<string, unknown> | undefined;
  return String(localized || item.title || item.name || fields?.fullName || fields?.contactName || fields?.name || fields?.company || fields?.email || item.email || item.path || item.id);
}

function statusName(status: unknown, english: boolean) {
  const values: Record<string, [string, string]> = { new: ["جديد", "New"], in_review: ["قيد المراجعة", "In review"], contacted: ["تم التواصل", "Contacted"], accepted: ["مقبول", "Accepted"], closed: ["مغلق", "Closed"], draft: ["مسودة", "Draft"], published: ["منشور", "Published"] };
  return values[String(status)]?.[english ? 1 : 0] || String(status || "");
}

function recordFields(item: Resource) {
  return item.fields && typeof item.fields === "object" ? item.fields as Record<string, unknown> : {};
}

function firstText(values: unknown[]) {
  const value = values.find((entry) => typeof entry === "string" && entry.trim());
  return typeof value === "string" ? value.trim() : "—";
}

function submissionDate(value: unknown, english: boolean) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(english ? "en" : "ar", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AdminConsole() {
  const english = useLocale() === "en";
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [collection, setCollection] = useState("applications");
  const [items, setItems] = useState<Resource[]>([]);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!isFirebaseClientConfigured()) return;
    return onAuthStateChanged(getFirebaseAuth(), setAuthUser);
  }, []);

  async function token() {
    if (!authUser) throw new Error(english ? "Sign in first" : "سجّل الدخول أولًا");
    return authUser.getIdToken();
  }

  async function request(path: string, init: RequestInit = {}) {
    const idToken = await token();
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init.headers } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || (english ? "Request failed" : "تعذر إتمام الطلب"));
    return result;
  }

  async function loadItems(nextCollection = collection) {
    if (nextCollection === "team") { setItems([]); setSelected(null); setDraft(""); setError(""); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const result = await request(`/api/admin/data?collection=${nextCollection}`);
      setItems(result.items || []);
      setSelected(null);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : english ? "Could not load records" : "تعذر تحميل السجلات");
      setItems([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (authUser) void loadItems(); }, [authUser, collection]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password); setPassword(""); }
    catch { setError(english ? "Could not sign in. Check the email, password, and Firebase Authentication setup." : "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور وإعداد Firebase Authentication."); }
    finally { setBusy(false); }
  }

  function choose(item: Resource) { setSelected(item); setDraft(JSON.stringify(item, null, 2)); setError(""); setNotice(""); }
  function createRecord() { const value = starterRecord(collection); setSelected(value); setDraft(JSON.stringify(value, null, 2)); setError(""); setNotice(""); }

  async function saveRecord() {
    setBusy(true); setError(""); setNotice("");
    try {
      const value = JSON.parse(draft) as Resource;
      const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : undefined;
      const result = await request(`/api/admin/data?collection=${collection}`, { method: "POST", body: JSON.stringify({ id, data: value }) });
      const saved = { ...value, id: result.id };
      setSelected(saved); setDraft(JSON.stringify(saved, null, 2));
      setNotice(english ? "Saved" : "تم الحفظ");
      if (collection === "brand") window.dispatchEvent(new Event("sea:brand-updated"));
      await loadItems(collection);
      setSelected(saved); setDraft(JSON.stringify(saved, null, 2));
    } catch (caught) { setError(caught instanceof Error ? caught.message : english ? "Could not save this record" : "تعذر حفظ السجل"); }
    finally { setBusy(false); }
  }

  async function deleteRecord() {
    if (!selected?.id) return;
    setBusy(true); setError("");
    try {
      if (collection === "media" && typeof selected.publicId === "string" && selected.publicId.startsWith("sea/website/")) {
        const confirmed = window.confirm(english ? "Delete this media record and permanently remove its Cloudinary file?" : "هل تريد حذف سجل الوسائط وإزالة الملف نهائيًا من Cloudinary؟");
        if (!confirmed) { setBusy(false); return; }
        await request("/api/admin/cloudinary-delete", { method: "POST", body: JSON.stringify({ publicId: selected.publicId, resourceType: selected.resourceType || "image" }) });
      }
      await request(`/api/admin/data?collection=${collection}&id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      setSelected(null); setDraft(""); setNotice(english ? "Deleted" : "تم الحذف"); await loadItems(collection);
    } catch (caught) { setError(caught instanceof Error ? caught.message : english ? "Could not delete" : "تعذر الحذف"); }
    finally { setBusy(false); }
  }

  async function uploadMedia(file: File) {
    setBusy(true); setError(""); setNotice("");
    try {
      const signature = await request("/api/admin/cloudinary-signature", { method: "POST", body: "{}" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signature.apiKey);
      formData.append("timestamp", String(signature.timestamp));
      formData.append("folder", signature.folder);
      formData.append("allowed_formats", signature.allowedFormats);
      formData.append("signature", signature.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`, { method: "POST", body: formData });
      const uploaded = await response.json();
      if (!response.ok) throw new Error(uploaded.error?.message || "Cloudinary upload failed");
      const saved = await request("/api/admin/data?collection=media", { method: "POST", body: JSON.stringify({ data: { id: uploaded.public_id.replaceAll("/", "__"), status: "draft", publicId: uploaded.public_id, url: uploaded.secure_url, resourceType: uploaded.resource_type, format: uploaded.format, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, originalName: file.name } }) });
      setNotice(english ? "Upload completed and added to the media library" : "اكتمل الرفع وأُضيف إلى مكتبة الوسائط");
      setCollection("media"); await loadItems("media");
      const uploadedRecord = { id: saved.id, publicId: uploaded.public_id, url: uploaded.secure_url, resourceType: uploaded.resource_type, originalName: file.name } as Resource;
      setSelected(uploadedRecord); setDraft(JSON.stringify(uploadedRecord, null, 2));
    } catch (caught) { setError(caught instanceof Error ? caught.message : english ? "Upload failed" : "فشل رفع الملف"); }
    finally { setBusy(false); }
  }

  const filteredItems = useMemo(() => items.filter((item) => `${itemName(item, collection, english)} ${JSON.stringify(item)}`.toLowerCase().includes(filter.toLowerCase()) && (statusFilter === "all" || item.status === statusFilter)), [items, collection, english, filter, statusFilter]);
  const parsedDraft = useMemo(() => { try { return JSON.parse(draft) as Resource; } catch { return null; } }, [draft]);
  const readOnlyCollection = ["applications", "employer_inquiries", "contact_inquiries", "audit_logs"].includes(collection);
  const groupedResources = ["inbox", "site", "settings"].map((group) => ({ group, values: resources.filter((item) => item.group === group) }));
  const submissions = ["applications", "employer_inquiries", "contact_inquiries"].includes(collection);
  const freshCount = items.filter((item) => item.status === "new").length;

  function exportCsv() {
    const rows = items.map((item) => ({ id: item.id, status: item.status, createdAt: item.createdAt, ...(item.fields as object || {}) }));
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const escape = (value: unknown) => {
      const cell = value == null ? "" : String(value).replace(/[\r\n]+/g, " ");
      const safe = /^[=+@\-]/.test(cell) ? `'${cell}` : cell;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [columns.map(escape).join(","), ...rows.map((row) => columns.map((column) => escape(row[column as keyof typeof row])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${collection}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  if (!isFirebaseClientConfigured()) return <section className="admin-shell"><div className="admin-notice"><CircleAlert /><div><h1>{english ? "Firebase is not configured" : "لم يتم إعداد Firebase"}</h1><p>{english ? "Add the public Firebase client values to the local environment file, then restart Next.js." : "أضف إعدادات Firebase العامة إلى ملف البيئة المحلي ثم أعد تشغيل Next.js."}</p></div></div></section>;

  if (!authUser) return <section className="admin-shell admin-login"><div className="admin-login__card"><span className="admin-brand"><ShieldCheck size={25} /></span><p className="eyebrow">SEA · {english ? "ADMINISTRATION" : "الإدارة"}</p><h1>{english ? "Sign in to manage the Academy" : "تسجيل الدخول لإدارة الأكاديمية"}</h1><p>{english ? "Use an account created by the Firebase project administrator." : "استخدم حسابًا أنشأه مدير مشروع Firebase."}</p><form onSubmit={login} className="admin-login__form"><label>{english ? "Email" : "البريد الإلكتروني"}<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>{english ? "Password" : "كلمة المرور"}<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button button--primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : null}{english ? "Sign in" : "دخول"}</button></form>{error && <p className="admin-error" role="alert">{error}</p>}<p className="admin-login__foot"><ShieldCheck size={15} />{english ? "Admin access is verified on the server." : "تُتحقق صلاحيات الإدارة على الخادم."}</p></div></section>;

  return <section className="admin-shell"><div className="admin-topbar"><div><span className="admin-brand"><Database size={20} /></span><div><span className="admin-topbar__eyebrow">SEA ADMIN</span><strong>{english ? "Academy control panel" : "لوحة تحكم الأكاديمية"}</strong></div></div><div className="admin-topbar__actions"><span className="admin-user">{authUser.email}</span><button className="admin-icon-button" title={english ? "Sign out" : "تسجيل الخروج"} onClick={() => signOut(getFirebaseAuth())}><LogOut size={18} /></button></div></div>
    <div className="admin-welcome"><div><p className="eyebrow"><span className="eyebrow__dot" />{english ? "Management workspace" : "مساحة الإدارة"}</p><h1>{english ? "Everything the team manages, in one place" : "إدارة المنصة من مكان واحد"}</h1><p>{english ? "Update bilingual content, follow submissions, manage brand settings and upload media." : "حدّث المحتوى باللغتين، وتابع الطلبات، وأدر الهوية والوسائط."}</p></div><div className="admin-welcome__badge"><ShieldCheck /><span>{english ? "Protected workspace" : "مساحة محمية"}</span></div></div>
    <div className="admin-workspace"><aside className="admin-sidebar">{groupedResources.map(({ group, values }) => <div className="admin-nav-group" key={group}><p>{group === "inbox" ? english ? "INBOX" : "الطلبات" : group === "site" ? english ? "SITE CONTENT" : "محتوى الموقع" : english ? "SETTINGS" : "الإعدادات"}</p>{values.map((item) => <button key={item.id} className={`admin-nav-item ${collection === item.id ? "is-active" : ""}`} onClick={() => { setCollection(item.id); setFilter(""); setStatusFilter("all"); }}>{item.id === "applications" ? <FileText size={17} /> : item.id === "media" ? <ImagePlus size={17} /> : <ChevronRight size={16} />}<span>{english ? item.en : item.ar}</span><ChevronRight className="admin-nav-arrow" size={15} /></button>)}</div>)}</aside>
      <div className="admin-main"><div className="admin-section-heading"><div><span>{english ? "WORKSPACE" : "مساحة العمل"}</span><h2>{resourceName(collection, english)}</h2></div><div className="admin-section-actions">{submissions && <button className="admin-secondary-button" onClick={exportCsv} disabled={!items.length}><ArrowDownToLine size={15}/>{english ? "Export CSV" : "تصدير CSV"}</button>}<button className="admin-secondary-button" onClick={() => void loadItems()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} />{english ? "Refresh" : "تحديث"}</button>{!collection.endsWith("inquiries") && !["applications", "audit_logs", "brand", "admissions"].includes(collection) && <button className="button button--primary admin-create-button" onClick={createRecord}>＋ {english ? "New record" : "سجل جديد"}</button>}</div></div>
        {submissions && <div className="admin-stats"><article><span>{english ? "Requests loaded" : "طلبات محمّلة"}</span><strong>{items.length}</strong><small>{english ? "Latest 100" : "آخر 100 طلب"}</small></article><article><span>{english ? "New" : "جديد"}</span><strong>{freshCount}</strong><small>{english ? "Need a first review" : "تحتاج مراجعة أولى"}</small></article><article><span>{english ? "In progress" : "قيد المتابعة"}</span><strong>{items.filter((item) => ["in_review", "contacted"].includes(String(item.status))).length}</strong><small>{english ? "Being followed up" : "تتم متابعتها"}</small></article><article><span>{english ? "Closed" : "مغلقة"}</span><strong>{items.filter((item) => ["accepted", "closed"].includes(String(item.status))).length}</strong><small>{english ? "Completed or closed" : "مكتملة أو مغلقة"}</small></article></div>}
        {collection === "team" ? <AdminTeamManager authUser={authUser} english={english} /> : <>
        {collection === "pages" && <div className="admin-guide"><FileText size={17} /><span>{english ? "Published page records replace the matching public route. Keep Arabic and English fields in the same record; section text is rendered as plain text." : "سجلات الصفحات المنشورة تظهر بدل الصفحة المقابلة. احفظ العربية والإنجليزية في السجل نفسه، وتظهر نصوص الأقسام كنص آمن."}</span></div>}
        {collection === "brand" && <div className="admin-guide"><Eye size={17} /><span>{english ? "Use this record for logo, footer logo, favicon, colors, fonts, contact details and social links. The website theme will read the published `main` record." : "استخدم هذا السجل للشعار وشعار الفوتر والفافيكون والألوان والخطوط والتواصل وروابط التواصل. ستقرأ الواجهة سجل `main` المنشور."}</span></div>}
        {collection === "media" && <><div className="admin-guide"><ImagePlus size={17} /><span>{english ? "Select an asset to preview it, edit its descriptions or URL, replace it, or permanently delete it from Cloudinary. Save changes after replacing or removing an image." : "اختر ملفًا لمعاينته وتعديل وصفه أو رابطه أو استبداله أو حذفه نهائيًا من Cloudinary. احفظ التغييرات بعد الاستبدال أو الإزالة."}</span></div><label className="admin-upload"><CloudUpload size={20} /><span>{english ? "Upload images or video" : "ارفع صورة أو فيديو"}<small>{english ? "Files are stored in Cloudinary through a server-signed upload." : "يُرفع الملف إلى Cloudinary بتوقيع يصدره الخادم."}</small></span><input type="file" accept="image/*,video/*" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></label></>}
        {error && <div className="admin-error admin-banner" role="alert"><CircleAlert size={17} />{error}</div>}{notice && <div className="admin-success" role="status"><Check size={17} />{notice}</div>}
        <div className={`admin-record-layout${submissions ? " admin-record-layout--submissions" : ""}`}><div className="admin-record-list"><div className="admin-record-list__head"><strong>{english ? "Records" : "السجلات"} <span>{filteredItems.length}</span></strong><input type="search" placeholder={english ? "Search" : "بحث"} value={filter} onChange={(event) => setFilter(event.target.value)} />{submissions && <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{english ? "All statuses" : "كل الحالات"}</option><option value="new">{statusName("new", english)}</option><option value="in_review">{statusName("in_review", english)}</option><option value="contacted">{statusName("contacted", english)}</option><option value="accepted">{statusName("accepted", english)}</option><option value="closed">{statusName("closed", english)}</option></select>}</div>{submissions ? <div className="admin-submissions-table-wrap"><table className="admin-submissions-table"><thead><tr><th>{english ? "Name / organization" : "الاسم / المنشأة"}</th><th>{english ? "Email" : "البريد الإلكتروني"}</th><th>{english ? "Phone" : "الجوال"}</th><th>{collection === "applications" ? english ? "Program" : "البرنامج" : collection === "employer_inquiries" ? english ? "Organization" : "المنشأة" : english ? "Subject" : "الموضوع"}</th><th>{english ? "Status" : "الحالة"}</th><th>{english ? "Received" : "تاريخ الإرسال"}</th><th>{english ? "" : ""}</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}><div className="admin-empty"><LoaderCircle className="spin" />{english ? "Loading" : "جارٍ التحميل"}</div></td></tr> : filteredItems.length ? filteredItems.map((item) => { const fields = recordFields(item); const joinedName = [fields.firstName, fields.lastName].filter((entry) => typeof entry === "string" && entry.trim()).join(" "); const name = firstText([fields.fullName, fields.contactName, fields.name, joinedName, fields.company, item.email]); const email = firstText([fields.email, item.email]); const phone = firstText([fields.phone, fields.phoneNumber, item.phone]); const topic = firstText([fields.programName, fields.program, fields.track, fields.subject, fields.company, fields.interest]); return <tr className={selected?.id === item.id ? "is-selected" : ""} key={item.id}><td><button className="admin-table-select" onClick={() => choose(item)}>{name}</button></td><td dir="ltr">{email}</td><td dir="ltr">{phone}</td><td>{topic}</td><td><span className="admin-table-status">{statusName(item.status, english)}</span></td><td>{submissionDate(item.createdAt, english)}</td><td><button className="admin-secondary-button" onClick={() => choose(item)}>{english ? "View" : "عرض"}</button></td></tr>; }) : <tr><td colSpan={7}><div className="admin-empty">{english ? "No submissions found" : "لا توجد طلبات مطابقة"}</div></td></tr>}</tbody></table></div> : loading ? <div className="admin-empty"><LoaderCircle className="spin" />{english ? "Loading" : "جارٍ التحميل"}</div> : filteredItems.length ? filteredItems.map((item) => <button className={`admin-record ${selected?.id === item.id ? "is-selected" : ""}`} key={item.id} onClick={() => choose(item)}><span>{itemName(item, collection, english)}</span><small>{statusName(item.status, english) || String(item.createdAt || item.id)}</small></button>) : <div className="admin-empty">{english ? "No records yet" : "لا توجد سجلات بعد"}</div>}</div>
          <div className="admin-editor"><div className="admin-editor__head"><div><strong>{selected ? selected.id || (english ? "New record" : "سجل جديد") : english ? "Choose a record" : "اختر سجلًا"}</strong><span>{selected ? english ? "Firestore record" : "سجل Firestore" : english ? "Select a record or create one" : "اختر سجلًا أو أنشئ سجلًا"}</span></div>{selected?.id && !["applications", "audit_logs", "brand", "admissions"].includes(collection) && !collection.endsWith("inquiries") && <button className="admin-icon-button danger" title={english ? "Delete record" : "حذف السجل"} onClick={() => void deleteRecord()} disabled={busy}><Trash2 size={17} /></button>}</div>
            {selected ? <>{parsedDraft && <AdminRecordFields collection={collection} value={parsedDraft} english={english} onChange={(value) => setDraft(JSON.stringify(value, null, 2))} onMediaUploaded={async (asset, file) => { const id = asset.publicId.replaceAll("/", "__"); await request("/api/admin/data?collection=media", { method: "POST", body: JSON.stringify({ id, data: { id, status: "draft", publicId: asset.publicId, url: asset.url, resourceType: asset.resourceType, format: asset.format, width: asset.width, height: asset.height, bytes: asset.bytes, originalName: file.name } }) }); }} />}<details className="admin-advanced"><summary>{english ? "Advanced record data" : "البيانات المتقدمة للسجل"}</summary><label className="admin-json-label"><textarea className="admin-json-editor" spellCheck={false} value={draft} readOnly={readOnlyCollection} onChange={(event) => setDraft(event.target.value)} aria-label={english ? "JSON record editor" : "محرر بيانات JSON"} /></label></details><div className="admin-editor__footer"><span>{english ? "Publishing changes content on the public website. Save a draft to keep it private." : "نشر السجل يعرض المحتوى على الموقع. احفظه كمسودة لإبقائه خاصًا."}</span><button className="button button--primary" onClick={() => void saveRecord()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{english ? "Save changes" : "حفظ التغييرات"}</button></div></> : <div className="admin-empty admin-empty--editor"><Database size={26} /><strong>{english ? "Select a record to edit" : "اختر سجلًا للتعديل"}</strong><span>{english ? "Your access controls are enforced by Firebase Admin on the server." : "تُطبق صلاحياتك من Firebase Admin على الخادم."}</span></div>}
          </div></div>
        {collection === "pages" && <div className="admin-path-list"><strong>{english ? "Available public pages" : "صفحات الموقع المتاحة"}</strong><div>{pagePaths.map((path) => <button key={path} onClick={() => { const id = path.replace(/^\/+|\/+$/g, "").replaceAll("/", "__") || "home"; const existing = items.find((item) => item.id === id); if (existing) choose(existing); else { const value = starterRecord("pages"); value.id = id; value.path = path; choose(value); } }}>{path}</button>)}</div></div>}
        {collection === "applications" && <div className="admin-guide admin-guide--subtle"><ArrowDownToLine size={16} /><span>{english ? "Select a record to view submitted contact details. National ID and document uploads are not collected in this version." : "اختر سجلًا لمراجعة بيانات التواصل. لا نجمع رقم الهوية أو الملفات في هذه النسخة."}</span></div>}
        </>}
      </div></div>
  </section>;
}
