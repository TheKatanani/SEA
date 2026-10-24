"use client";
import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { PublicCohort } from "./CohortOptions";
type Row = Record<string, unknown> & { id: string };
const empty = { programCollection: "programs", programId: "", cohortCode: "", titleAr: "", titleEn: "", price: "", start: "", end: "", scheduleAr: "", scheduleEn: "", locationType: "in_person", venueAr: "فرع الربوة - الرياض", venueEn: "Al-Rabwah Campus, Riyadh", capacity: "25", status: "draft", registrationOpen: false, id: "" };
const localDate = (value: string) => new Date(Date.parse(value) + 3 * 3600000).toISOString().slice(0, 16);
export function TrainingAdmin({ user, english: en }: { user: User; english: boolean }) {
  const [collection, setCollection] = useState("cohorts"); const [items, setItems] = useState<Row[]>([]);
  const [programs, setPrograms] = useState<Row[]>([]); const [form, setForm] = useState(empty); const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [cohortFilter, setCohortFilter] = useState(""); const [cohortQuery, setCohortQuery] = useState("");
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [appliedQ, setAppliedQ] = useState("");
  const [overview, setOverview] = useState<Record<string, number>>({});
  const [setup, setSetup] = useState<{ bookingReady: boolean; missing: string[]; demo: boolean; applicationsEnabled: boolean; webhookConfigured: boolean } | null>(null);
  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken(), ...init?.headers }, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "REQUEST_FAILED");
    return body;
  }, [user]);
  const params = useCallback(() => new URLSearchParams({ collection, ...(status ? { status } : {}), ...(collection === "bookings" && cohortFilter ? { cohortId: cohortFilter } : {}), ...(collection === "bookings" && appliedQ ? { q: appliedQ } : {}) }), [collection, status, appliedQ, cohortFilter]);
  const load = useCallback(async (after?: string) => {
    setBusy(true); setError("");
    try {
      const query = params(); if (after) query.set("cursor", after);
      const result = await request("/api/admin/training?" + query);
      setItems((old) => after ? [...old, ...result.items] : result.items); setCursor(result.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : "REQUEST_FAILED"); } finally { setBusy(false); }
  }, [params, request]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    request("/api/admin/training?overview=true").then(setOverview).catch(() => {});
    request("/api/admin/training?setup=true").then(setSetup).catch(() => {});
    Promise.all(["programs", "courses"].map(async (c) => {
      const r = await request("/api/admin/data?collection=" + c);
      return (r.items as Row[]).filter((p) => p.status === "published").map((p) => ({ ...p, collection: c }));
    })).then((groups) => setPrograms(groups.flat())).catch(() => {});
  }, [request]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await request("/api/admin/training", { method: "POST", body: JSON.stringify({
        ...(form.id ? { id: form.id } : {}), programCollection: form.programCollection, programId: form.programId,
        cohortCode: form.cohortCode, titleAr: form.titleAr, titleEn: form.titleEn, priceMinor: Math.round(Number(form.price) * 100), currency: "SAR",
        startAt: new Date(form.start + ":00+03:00").toISOString(), endAt: new Date(form.end + ":00+03:00").toISOString(), timeZone: "Asia/Riyadh",
        scheduleAr: form.scheduleAr, scheduleEn: form.scheduleEn, locationType: form.locationType, venueAr: form.venueAr, venueEn: form.venueEn,
        capacity: Number(form.capacity), status: form.status, registrationOpen: form.registrationOpen,
      }) });
      setNotice(en ? "Cohort saved" : "حُفظت الدفعة"); setForm(empty); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "SAVE_FAILED"); } finally { setBusy(false); }
  }
  function edit(row: Row) {
    const c = row as unknown as PublicCohort;
    setForm({ id: c.id, programCollection: c.programCollection, programId: c.programId, cohortCode: c.cohortCode, titleAr: c.titleAr, titleEn: c.titleEn,
      price: String(c.priceMinor / 100), start: localDate(c.startAt), end: localDate(c.endAt), scheduleAr: c.scheduleAr, scheduleEn: c.scheduleEn,
      locationType: c.locationType, venueAr: c.venueAr, venueEn: c.venueEn, capacity: String(c.capacity), status: c.status, registrationOpen: c.registrationOpen });
    document.querySelector("#cohort-editor")?.scrollIntoView({ behavior: "smooth" });
  }
  async function exportFile(format: string) {
    setBusy(true); setError("");
    try {
      const query = params(); query.set("format", format);
      const response = await fetch("/api/admin/training/export?" + query, { headers: { Authorization: "Bearer " + await user.getIdToken() }, cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()); const a = document.createElement("a"); a.href = url; a.download = "sea-registrants." + format; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "EXPORT_FAILED"); } finally { setBusy(false); }
  }
  async function reconcile(id: string) {
    setBusy(true); setError("");
    try { await request("/api/admin/training/payments", { method: "POST", body: JSON.stringify({ paymentId: id, action: "reconcile" }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "VERIFY_FAILED"); } finally { setBusy(false); }
  }
  async function refund(id: string) {
    if (!window.confirm(en ? "Refund the full remaining amount to the payer? This sends a real refund request to Moyasar." : "هل تريد استرجاع كامل المبلغ المتبقي إلى الدافع؟ سيُرسل طلب استرجاع فعلي إلى ميسر.")) return;
    setBusy(true); setError("");
    try { await request("/api/admin/training/payments", { method: "POST", body: JSON.stringify({ paymentId: id, action: "refund", confirm: true }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "REFUND_FAILED"); } finally { setBusy(false); }
  }
  async function cancel(bookingId: string) {
    if (!window.confirm(en ? "Cancel this pending reservation and release the seat?" : "إلغاء الحجز المعلق وتحرير المقعد؟")) return;
    setBusy(true); setError("");
    try { await request("/api/admin/training/bookings", { method: "POST", body: JSON.stringify({ bookingId, action: "cancel" }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "CANCEL_FAILED"); } finally { setBusy(false); }
  }
  const textInput = (name: keyof typeof empty, label: string, type = "text") => <label>{label}<input type={type} required value={String(form[name])} onChange={(e) => setForm((v) => ({ ...v, [name]: e.target.value }))} {...(type === "number" ? { min: name === "capacity" ? 1 : 1, step: name === "capacity" ? 1 : 0.01, max: name === "capacity" ? 500 : 100000 } : {})} /></label>;
  const bookingStates: Record<string, string> = en ? { PENDING: "Pending", CONFIRMED: "Confirmed", EXPIRED: "Expired", CANCELLED: "Cancelled", REFUND_PENDING: "Refund review", REFUNDED: "Refunded" } : { PENDING: "معلق", CONFIRMED: "مؤكد", EXPIRED: "انتهت المهلة", CANCELLED: "ملغي", REFUND_PENDING: "مراجعة استرجاع", REFUNDED: "مسترجع" };
  return <div className="training-admin">
    {setup && <section className="training-setup" aria-label={en ? "Booking setup" : "جاهزية الحجز"}><h2>{en ? "Booking setup" : "جاهزية الحجز"}{setup.demo ? en ? " · Sandbox" : " · تجريبي" : ""}</h2><p>{setup.bookingReady ? en ? "Payment configuration is ready. Publish a cohort and enable its registration to show its booking button." : "إعدادات الدفع جاهزة. انشر دفعة وافتح تسجيلها ليظهر زر الحجز في صفحة البرنامج." : en ? "Complete these deployment settings to enable the booking button:" : "أكمل إعدادات بيئة النشر التالية لتفعيل زر الحجز:"}</p>{setup.missing.length > 0 && <ul>{setup.missing.map((key) => <li key={key}><code>{key}</code></li>)}</ul>}{!setup.webhookConfigured && <p>{en ? "Moyasar webhook secret is not configured yet." : "لم يُضبط سر إشعارات ميسر بعد."}</p>}{!setup.applicationsEnabled && <p>{en ? "Interest submissions are disabled (APPLICATIONS_ENABLED)." : "استقبال نماذج الاهتمام معطل (APPLICATIONS_ENABLED)."}</p>}</section>}
    <div className="training-metrics">{[[en ? "Cohorts" : "الدفعات", overview.cohorts], [en ? "Confirmed seats" : "مقاعد مؤكدة", overview.confirmed], [en ? "Active holds" : "حجوزات مؤقتة", overview.pending], [en ? "Net payments (SAR)" : "صافي المدفوعات (ريال)", (overview.revenueMinor || 0) / 100]].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value ?? "—"}</strong></article>)}</div>
    <nav className="training-tabs" aria-label={en ? "Training management" : "إدارة التدريب"}>{["cohorts", "bookings", "payments"].map((c, index) => <button className={collection === c ? "is-active" : ""} key={c} onClick={() => { setCollection(c); setStatus(""); setAppliedQ(""); setQ(""); setCohortFilter(""); setCohortQuery(""); }}>{(en ? ["Cohorts & capacity", "Bookings & registrants", "Payments"] : ["الدفعات والسعة", "الحجوزات والمسجلون", "المدفوعات"])[index]}</button>)}</nav>
    <div className="training-toolbar">{collection === "bookings" && <form onSubmit={(e) => { e.preventDefault(); setAppliedQ(q.trim()); setCohortFilter(cohortQuery.trim()); }}><input aria-label={en ? "Search bookings" : "بحث الحجوزات"} placeholder={en ? "Name, email, ID or booking number" : "الاسم أو البريد أو الهوية أو رقم الحجز"} value={q} onChange={(e) => setQ(e.target.value)} /><input aria-label={en ? "Cohort ID" : "معرّف الدفعة"} placeholder={en ? "Cohort ID (optional)" : "معرّف الدفعة (اختياري)"} value={cohortQuery} onChange={(e) => setCohortQuery(e.target.value)} /><button type="submit">{en ? "Search" : "بحث"}</button></form>}
      <select aria-label={en ? "Status" : "الحالة"} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{en ? "All statuses" : "جميع الحالات"}</option>{(collection === "bookings" ? Object.entries(bookingStates) : collection === "payments" ? ["paid", "failed", "refunded", "captured"].map((v) => [v, v]) : [["draft", en ? "Draft" : "مسودة"], ["published", en ? "Published" : "منشور"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button onClick={() => void load()} disabled={busy}>{en ? "Refresh" : "تحديث"}</button>{collection === "bookings" && <><button onClick={() => void exportFile("xlsx")} disabled={busy}>Excel</button><button onClick={() => void exportFile("csv")} disabled={busy}>CSV</button></>}
    </div>
    {error && <p className="training-alert" role="alert">{({ CAPACITY_BELOW_COMMITMENTS: en ? "Capacity cannot be lower than confirmed and held seats." : "لا يمكن خفض السعة عن المقاعد المؤكدة والمحجوزة مؤقتاً.", PROGRAM_NOT_PUBLISHED: en ? "Publish the program before enabling the cohort." : "انشر البرنامج قبل تفعيل الدفعة.", COHORT_CODE_EXISTS: en ? "This cohort code already exists." : "رمز الدفعة مستخدم مسبقاً.", COHORT_CODE_IMMUTABLE: en ? "The cohort code cannot be changed after creation." : "لا يمكن تغيير رمز الدفعة بعد إنشائها.", INVALID_COHORT: en ? "Check all dates, fees and required fields." : "راجع المواعيد والرسوم والحقول الإلزامية.", REFUND_OUTCOME_PENDING_RECONCILE_FIRST: en ? "The previous refund needs reconciliation in Moyasar before another request." : "تحتاج نتيجة الاسترجاع السابقة للمراجعة في ميسر قبل طلب آخر.", SERVICE_UNAVAILABLE: en ? "The service or its database indexes are not ready. Please try again later." : "الخدمة أو فهارس قاعدة البيانات غير جاهزة. يرجى المحاولة لاحقاً." } as Record<string,string>)[error] || (en ? "The operation could not be completed. Check your access and the service setup." : "تعذر إتمام العملية. راجع صلاحياتك وإعداد الخدمة.")}</p>}{notice && <p role="status">{notice}</p>}
    <div className="training-table-wrap"><table className="training-table"><thead><tr>{(collection === "cohorts" ? en ? ["Cohort", "Price", "Capacity / available", "Registration", ""] : ["الدفعة", "السعر", "السعة / المتاح", "التسجيل", ""] : collection === "bookings" ? en ? ["Reference / learner", "Email / mobile", "Cohort", "Status", "Amount"] : ["المرجع / المتدرب", "البريد / الجوال", "الدفعة", "الحالة", "المبلغ"] : en ? ["Payment", "Booking", "Status", "Amount", "Action"] : ["العملية", "الحجز", "الحالة", "المبلغ", "الإجراء"]).map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{items.map((row) => {
      const a = row.attendee as Record<string, string> | undefined;
      return <tr key={row.id}>{collection === "cohorts" ? <><td><strong>{String(en ? row.titleEn : row.titleAr)}</strong><small>{String(row.cohortCode)}</small></td><td>{Number(row.priceMinor) / 100} SAR</td><td>{String(row.capacity)} / {String(row.remaining)}</td><td>{row.registrationOpen ? en ? "Open" : "مفتوح" : en ? "Closed" : "مغلق"}</td><td><button onClick={() => edit(row)}>{en ? "Edit" : "تعديل"}</button></td></> : collection === "bookings" ? <><td><strong>{String(row.bookingNumber)}</strong><small>{a?.fullName}</small></td><td>{a?.email}<small dir="ltr">{a?.mobile}</small></td><td>{String(row.cohortId)}</td><td>{bookingStates[String(row.status)] || String(row.status)}{row.status === "PENDING" && <button disabled={busy} onClick={() => void cancel(row.id)}>{en ? "Cancel" : "إلغاء"}</button>}</td><td>{Number(row.amountMinor) / 100} SAR</td></> : <><td>{row.id}</td><td>{String(row.bookingId)}</td><td>{String(row.status)}{row.refundRequired === true && <strong>{en ? "Refund required" : "يلزم استرجاع"}</strong>}</td><td>{Number(row.amountMinor) / 100} SAR</td><td><button disabled={busy} onClick={() => void reconcile(row.id)}>{en ? "Verify with Moyasar" : "تحقق من ميسر"}</button>{["paid", "captured", "refunded"].includes(String(row.status)) && Number(row.refundedMinor || 0) < Number(row.amountMinor) && <button disabled={busy} onClick={() => void refund(row.id)}>{en ? "Full refund" : "استرجاع كامل"}</button>}</td></>}</tr>;
    })}{!items.length && <tr><td colSpan={5}>{busy ? en ? "Loading…" : "جارٍ التحميل…" : en ? "No records" : "لا توجد سجلات"}</td></tr>}</tbody></table></div>{cursor && <button disabled={busy} onClick={() => void load(cursor)}>{en ? "Load more" : "تحميل المزيد"}</button>}
    {collection === "cohorts" && <form id="cohort-editor" className="training-form cohort-editor" onSubmit={save}><h2>{form.id ? en ? "Edit cohort" : "تعديل الدفعة" : en ? "New cohort" : "دفعة جديدة"}</h2><div className="training-input-grid">
      <label>{en ? "Program" : "البرنامج"}<select required disabled={!!form.id} value={form.programId ? form.programCollection + "/" + form.programId : ""} onChange={(e) => { const [programCollection, programId] = e.target.value.split("/"); setForm((v) => ({ ...v, programCollection, programId })); }}><option value="">{en ? "Choose published program" : "اختر برنامجاً منشوراً"}</option>{programs.map((p) => <option key={String(p.collection) + "/" + p.id} value={String(p.collection) + "/" + p.id}>{String((p.locales as Record<string, { title: string }>)?.[en ? "en" : "ar"]?.title || p.id)}</option>)}</select></label>
      {textInput("cohortCode", en ? "Cohort code" : "رمز الدفعة")}{textInput("titleAr", "اسم الدفعة بالعربية")}{textInput("titleEn", "Cohort title in English")}
      {textInput("price", en ? "Final fee (SAR)" : "الرسوم النهائية بالريال", "number")}{textInput("capacity", en ? "Capacity (max 500)" : "السعة (حتى 500)", "number")}
      {textInput("start", en ? "Starts (Riyadh time)" : "البداية بتوقيت الرياض", "datetime-local")}{textInput("end", en ? "Ends (Riyadh time)" : "النهاية بتوقيت الرياض", "datetime-local")}
      {textInput("scheduleAr", "الجدول بالعربية")}{textInput("scheduleEn", "Schedule in English")}
      <label>{en ? "Delivery" : "نمط التدريب"}<select value={form.locationType} onChange={(e) => setForm((v) => ({ ...v, locationType: e.target.value }))}><option value="in_person">{en ? "On campus" : "حضوري"}</option><option value="remote">{en ? "Online" : "عن بُعد"}</option></select></label>
      <label>{en ? "Publication" : "حالة النشر"}<select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}><option value="draft">{en ? "Draft" : "مسودة"}</option><option value="published">{en ? "Published" : "منشور"}</option></select></label>
      {textInput("venueAr", "الموقع بالعربية")}{textInput("venueEn", "Location in English")}
    </div><label className="training-consent"><input type="checkbox" checked={form.registrationOpen} onChange={(e) => setForm((v) => ({ ...v, registrationOpen: e.target.checked }))} />{en ? "Allow registration (subject to capacity and dates)" : "فتح التسجيل (وفق السعة والموعد)"}</label><div className="button-row"><button className="button button--primary" disabled={busy}>{en ? "Save cohort" : "حفظ الدفعة"}</button><button type="button" onClick={() => setForm(empty)}>{en ? "Clear" : "تفريغ"}</button></div><p className="training-note">{en ? "The fee must be the approved final amount. Existing bookings keep their original price." : "يجب أن تكون الرسوم النهائية معتمدة. تحتفظ الحجوزات السابقة بسعرها الأصلي."}</p></form>}
  </div>;
}

