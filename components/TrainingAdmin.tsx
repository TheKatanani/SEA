"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { Layers, Users, CreditCard, CheckCircle2, Clock, FileSpreadsheet, FileText, AlertCircle, RefreshCw, XCircle, Search, PlusCircle, Check, Sparkles } from "lucide-react";
import { cohortSuggestion } from "@/lib/admin/cohort-autofill";
import type { PublicCohort } from "./CohortOptions";
import { ContentAssistant, BilingualField } from "./ContentAssistant";
import { textPairs, type ContentRecord, type TranslationState } from "@/lib/admin/content";

type Row = Record<string, unknown> & { id: string };
const empty = { programCollection: "programs", programId: "", cohortCode: "", titleAr: "", titleEn: "", price: "", start: "", end: "", scheduleAr: "", scheduleEn: "", locationType: "in_person", venueAr: "", venueEn: "", capacity: "", status: "draft", registrationOpen: false, id: "" };
const localDate = (value: string) => new Date(Date.parse(value) + 3 * 3600000).toISOString().slice(0, 16);

export function TrainingAdmin({ user, english: en, activeTab = "cohorts", onDirtyChange, aiAvailable = false }: { user: User; english: boolean; activeTab?: string; onDirtyChange?: (value: boolean) => void; aiAvailable?: boolean }) {
  const collection = activeTab;
  const [items, setItems] = useState<Row[]>([]);
  const [programs, setPrograms] = useState<Row[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true), [catalogError, setCatalogError] = useState(false), [catalogRetry, setCatalogRetry] = useState(0);
  const programPicker = useRef<HTMLSelectElement>(null), nameFields = useRef<HTMLDivElement>(null);
  const [allCohorts, setAllCohorts] = useState<Row[]>([]);
  const [form, setForm] = useState(empty);
  const [savedForm, setSavedForm] = useState(empty);
  const [reviewedTranslations, setReviewedTranslations] = useState<string[]>([]);
  const [cohortReview, setCohortReview] = useState(false), [cohortReviewed, setCohortReviewed] = useState(false);
  const [translationState, setTranslationState] = useState<TranslationState>({});
  useEffect(() => { onDirtyChange?.(JSON.stringify(form) !== JSON.stringify(savedForm)); setCohortReviewed(false); return () => onDirtyChange?.(false); }, [form, savedForm, onDirtyChange]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cohortFilter, setCohortFilter] = useState("");
  const [cohortQuery, setCohortQuery] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [appliedQ, setAppliedQ] = useState("");

  const request = useCallback(
    async (url: string, init?: RequestInit) => {
      const response = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await user.getIdToken()), ...init?.headers },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "REQUEST_FAILED");
      return body;
    },
    [user]
  );

  const params = useCallback(
    () =>
      new URLSearchParams({
        collection,
        ...(status ? { status } : {}),
        ...(collection === "bookings" && cohortFilter ? { cohortId: cohortFilter } : {}),
        ...(collection === "bookings" && appliedQ ? { q: appliedQ } : {})
      }),
    [collection, status, appliedQ, cohortFilter]
  );

  const load = useCallback(
    async (after?: string) => {
      setBusy(true);
      setError("");
      try {
        const query = params();
        if (after) query.set("cursor", after);
        const result = await request("/api/admin/training?" + query);
        setItems((old) => (after ? [...old, ...result.items] : result.items));
        setCursor(result.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "REQUEST_FAILED");
      } finally {
        setBusy(false);
      }
    },
    [params, request]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true; setCatalogLoading(true); setCatalogError(false);
    Promise.allSettled(["programs", "courses"].map(async collection => {
      const result = await request("/api/admin/data?collection=" + collection + "&view=published");
      return (result.items as Row[]).filter(program => program.status === "published").map(program => ({ ...program, collection }));
    })).then(groups => {
      if (!active) return;
      setPrograms(groups.flatMap(group => group.status === "fulfilled" ? group.value : []));
      setCatalogError(groups.some(group => group.status === "rejected")); setCatalogLoading(false);
    });
    request("/api/admin/training?collection=cohorts").then(result => { if (active && Array.isArray(result.items)) setAllCohorts(result.items); }).catch(() => {});
    return () => { active = false; };
  }, [request, catalogRetry]);

  function autoFillCohort() {
    if (!form.programId) { setNotice(en ? "Choose a program or course below first." : "اختر البرنامج أو الدورة أدناه أولاً."); programPicker.current?.focus(); return; }
    const program = programs.find(item => item.collection === form.programCollection && item.id === form.programId);
    if (!program) { setNotice(en ? "The selected program is unavailable. Reload the course list and try again." : "البرنامج المختار غير متاح. أعد تحميل قائمة الدورات وحاول مجدداً."); return; }
    const suggestion = cohortSuggestion({ ...program, collection: String(program.collection) }, [...allCohorts, ...items], form);
    if (!suggestion) { setNotice(en ? "Add a title to this program before using autofill." : "أضف عنواناً للبرنامج أولاً حتى تعمل التعبئة التلقائية."); return; }
    setForm(current => ({ ...current, ...suggestion })); setReviewedTranslations([]); setCohortReview(false);
    setNotice(en ? "Cohort names and code filled. Confirm the fee, dates, venue and capacity before publishing." : "تمت تعبئة اسم الدفعة باللغتين ورمزها. أكد الرسوم والمواعيد والموقع والسعة قبل النشر.");
    nameFields.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function save(event: React.FormEvent, publish = false) {
    event.preventDefault();
    if (!document.querySelector<HTMLFormElement>("#cohort-editor")?.reportValidity()) return;
    if (publish && !cohortReviewed) { setError("REVIEW_REQUIRED"); return; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await request("/api/admin/training", {
        method: "POST",
        body: JSON.stringify({
          ...(form.id ? { id: form.id } : {}),
          programCollection: form.programCollection,
          programId: form.programId,
          cohortCode: form.cohortCode,
          titleAr: form.titleAr,
          titleEn: form.titleEn,
          priceMinor: Math.round(Number(form.price) * 100),
          currency: "SAR",
          startAt: new Date(form.start + ":00+03:00").toISOString(),
          endAt: new Date(form.end + ":00+03:00").toISOString(),
          timeZone: "Asia/Riyadh",
          scheduleAr: form.scheduleAr,
          scheduleEn: form.scheduleEn,
          locationType: form.locationType,
          venueAr: form.venueAr,
          venueEn: form.venueEn,
          capacity: Number(form.capacity),
          status: publish ? "published" : "draft",
          translationReview: { reviewed: publish ? (["ar", "en"] as const).flatMap(lang => textPairs("cohorts", form, lang).filter(p => p.source.trim() && p.target.trim()).map(p => lang + ":" + p.key)) : reviewedTranslations },
          registrationOpen: form.registrationOpen,
        }),
      });
      setNotice(en ? "Cohort saved successfully" : "حُفظت الدفعة بنجاح");
      const savedCode = form.cohortCode;
      const savedProg = form.programId;
      const savedCol = form.programCollection;
      setAllCohorts((prev) => [
        ...prev,
        { id: res?.id || String(Date.now()), cohortCode: savedCode, programId: savedProg, programCollection: savedCol }
      ]);
      setForm(empty); setSavedForm(empty); setCohortReview(false); setTranslationState({}); setReviewedTranslations([]);
      await load();
      request("/api/admin/training?collection=cohorts").then((r) => {
        if (Array.isArray(r.items)) setAllCohorts(r.items);
      }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "SAVE_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function edit(row: Row) {
    if (JSON.stringify(form) !== JSON.stringify(savedForm) && !window.confirm(en ? "Discard unsaved changes?" : "تجاهل التعديلات غير المحفوظة؟")) return;
    setBusy(true); setError("");
    let c: PublicCohort;
    try { const result = await request("/api/admin/training?cohortId=" + encodeURIComponent(row.id)); c = result.cohort; setTranslationState(result.translationState || {}); }
    catch { setError("SERVICE_UNAVAILABLE"); setBusy(false); return; }
    const next = {
      id: c.id,
      programCollection: c.programCollection,
      programId: c.programId,
      cohortCode: c.cohortCode,
      titleAr: c.titleAr,
      titleEn: c.titleEn,
      price: String(c.priceMinor / 100),
      start: localDate(c.startAt),
      end: localDate(c.endAt),
      scheduleAr: c.scheduleAr,
      scheduleEn: c.scheduleEn,
      locationType: c.locationType,
      venueAr: c.venueAr,
      venueEn: c.venueEn,
      capacity: String(c.capacity),
      status: c.status,
      registrationOpen: c.registrationOpen,
    };
    setForm(next); setSavedForm(next); setCohortReview(false);
    setBusy(false);
    document.querySelector("#cohort-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  async function exportFile(format: string) {
    setBusy(true);
    setError("");
    try {
      const query = params();
      query.set("format", format);
      const response = await fetch("/api/admin/training/export?" + query, { headers: { Authorization: "Bearer " + (await user.getIdToken()) }, cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "sea-registrants." + format;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "EXPORT_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(id: string) {
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/training/payments", { method: "POST", body: JSON.stringify({ paymentId: id, action: "reconcile" }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "VERIFY_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function refund(id: string) {
    if (!window.confirm(en ? "Refund the full amount to the payer? This sends an actual refund to Moyasar." : "هل تريد استرجاع كامل المبلغ للدافع؟ سيُرسل طلب استرجاع رسمي إلى ميسر.")) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/training/payments", { method: "POST", body: JSON.stringify({ paymentId: id, action: "refund", confirm: true }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "REFUND_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(bookingId: string) {
    if (!window.confirm(en ? "Cancel this pending reservation and release the seat?" : "إلغاء الحجز المعلق وتحرير المقعد فوراً؟")) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/training/bookings", { method: "POST", body: JSON.stringify({ bookingId, action: "cancel" }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "CANCEL_FAILED");
    } finally {
      setBusy(false);
    }
  }

  const textInput = (name: keyof typeof empty, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        required
        readOnly={name === "cohortCode" && Boolean(form.id)}
        value={String(form[name])}
        onChange={(e) => setForm((v) => ({ ...v, [name]: e.target.value }))}
        {...(type === "number" ? { min: name === "capacity" ? 1 : 1, step: name === "capacity" ? 1 : 0.01, max: name === "capacity" ? 500 : 100000 } : {})}
      />
    </label>
  );

  const bookingStates: Record<string, string> = en
    ? { PENDING: "Pending", CONFIRMED: "Confirmed", EXPIRED: "Expired", CANCELLED: "Cancelled", REFUND_PENDING: "Refund review", REFUNDED: "Refunded" }
    : { PENDING: "معلق", CONFIRMED: "مؤكد", EXPIRED: "انتهت المهلة", CANCELLED: "ملغي", REFUND_PENDING: "مراجعة استرجاع", REFUNDED: "مسترجع" };

  return (
    <div className="training-admin">
      {/* Toolbar */}
      <div className="training-toolbar">
        {collection === "bookings" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedQ(q.trim());
              setCohortFilter(cohortQuery.trim());
            }}
          >
            <input
              aria-label={en ? "Search bookings" : "بحث الحجوزات"}
              placeholder={en ? "Name, email, national ID, or ref number" : "الاسم أو البريد أو الهوية الوطنية أو رقم الحجز"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
<select aria-label={en ? "Cohort" : "الدفعة"} value={cohortQuery} onChange={e => setCohortQuery(e.target.value)}><option value="">{en ? "All cohorts" : "جميع الدفعات"}</option>{allCohorts.map(c => <option key={c.id} value={c.id}>{String(en ? c.titleEn || c.cohortCode : c.titleAr || c.cohortCode)}</option>)}</select>
            <button className="btn-export" type="submit">
              <Search size={14} />
              {en ? "Search" : "بحث"}
            </button>
          </form>
        )}

        <select aria-label={en ? "Status" : "الحالة"} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{en ? "All statuses" : "جميع الحالات"}</option>
          {(collection === "bookings"
            ? Object.entries(bookingStates)
            : collection === "payments"
            ? ["paid", "failed", "refunded", "captured"].map((v) => [v, v])
            : [
                ["draft", en ? "Draft" : "مسودة"],
                ["published", en ? "Published" : "منشور"],
              ]
          ).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button className="btn-export" onClick={() => void load()} disabled={busy}>
          <RefreshCw size={14} />
          {en ? "Refresh" : "تحديث"}
        </button>

        {collection === "bookings" && (
          <>
            <button className="btn-export btn-export--excel" onClick={() => void exportFile("xlsx")} disabled={busy}>
              <FileSpreadsheet size={15} />
              <span>{en ? "Export Excel" : "تصدير كشف Excel"}</span>
            </button>
            <button className="btn-export" onClick={() => void exportFile("csv")} disabled={busy}>
              <FileText size={15} />
              <span>{en ? "Export CSV" : "تصدير CSV"}</span>
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="training-alert" role="alert">
          {({
            CAPACITY_BELOW_COMMITMENTS: en ? "Capacity cannot be lower than confirmed and held seats." : "لا يمكن خفض السعة عن المقاعد المؤكدة والمحجوزة مؤقتاً.",
            PROGRAM_NOT_PUBLISHED: en ? "Publish the program before enabling the cohort." : "انشر البرنامج قبل تفعيل الدفعة.",
            COHORT_CODE_EXISTS: en ? "This cohort code already exists." : "رمز الدفعة مستخدم مسبقاً.",
            COHORT_CODE_IMMUTABLE: en ? "The cohort code cannot be changed after creation." : "لا يمكن تغيير رمز الدفعة بعد إنشائها.",
            REVIEW_REQUIRED: en ? "Review and confirm the cohort details before publishing." : "راجع بيانات الدفعة وأكدها قبل النشر.",
            INVALID_COHORT: en ? "Check all dates, fees and required fields." : "راجع المواعيد والرسوم والحقول الإلزامية.",
            REFUND_OUTCOME_PENDING_RECONCILE_FIRST: en ? "The previous refund needs reconciliation in Moyasar before another request." : "تحتاج نتيجة الاسترجاع السابقة للمراجعة في ميسر قبل طلب آخر.",
            SERVICE_UNAVAILABLE: en ? "The service or its database indexes are not ready. Please try again later." : "الخدمة أو فهارس قاعدة البيانات غير جاهزة. يرجى المحاولة لاحقاً.",
          } as Record<string, string>)[error] || (en ? "The operation could not be completed." : "تعذر إتمام العملية.")}
        </p>
      )}
      {notice && <p role="status" style={{ color: "#16a34a", fontWeight: "700", marginBottom: "12px" }}>{notice}</p>}

      {/* Table */}
      <div className="training-table-wrap">
        <table className="training-table">
          <thead>
            <tr>
              {(collection === "cohorts"
                ? en
                  ? ["Cohort", "Price", "Capacity / Available", "Registration", "Action"]
                  : ["الدفعة", "السعر", "السعة / المتاح", "التسجيل", "الإجراء"]
                : collection === "bookings"
                ? en
                  ? ["Reference / Learner", "Email / Mobile / ID", "Cohort", "Status", "Amount"]
                  : ["المرجع / المتدرب", "البريد / الجوال / الهوية", "الدفعة", "الحالة", "المبلغ"]
                : en
                ? ["Updated", "Booking / Learner", "Status", "Amount", "Action"]
                : ["آخر تحديث", "الحجز / المتدرب", "الحالة", "المبلغ", "الإجراء"]
              ).map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const a = row.attendee as Record<string, string> | undefined;
              return (
                <tr key={row.id}>
                  {collection === "cohorts" ? (
                    <>
                      <td>
                        <strong>{String(en ? row.titleEn : row.titleAr)}</strong>
                        <span className="cohort-code-badge">{String(row.cohortCode)}</span>
                        {row.hasDraft === true && <small>{en ? "Unpublished changes" : "تعديلات غير منشورة"}</small>}
                      </td>
                      <td>
                        <strong style={{ color: "var(--sea-primary)" }}>{Number(row.priceMinor) / 100} SAR</strong>
                      </td>
                      <td>
                        <strong style={{ color: Number(row.remaining) === 0 ? "#b91c1c" : "#047857" }}>
                          {String(row.remaining)}
                        </strong>{" "}
                        / {String(row.capacity)}
                      </td>
                      <td>
                        <span className={`status-badge ${row.registrationOpen ? "status-badge--confirmed" : "status-badge--expired"}`}>
                          {row.registrationOpen ? (en ? "Open" : "مفتوح") : en ? "Closed" : "مغلق"}
                        </span>
                      </td>
                      <td>
                        <button className="btn-export" disabled={busy} onClick={() => void edit(row)}>
                          {en ? "Edit" : "تعديل"}
                        </button>
                      </td>
                    </>
                  ) : collection === "bookings" ? (
                    (() => {
                      const cohort = allCohorts.find((c) => c.id === row.cohortId);
                      return (
                        <>
                          <td>
                            <strong className="receipt-number-badge" style={{ fontSize: "13px" }}>{String(row.bookingNumber)}</strong>
                            <small style={{ fontWeight: "700", color: "#0f172a" }}>{a?.fullName}</small>
                          </td>
                          <td>
                            {a?.email}
                            <small dir="ltr" style={{ color: "#475569" }}>
                              {a?.mobile}
                              {a?.nationalId ? ` · هوية: ${a.nationalId}` : ""}
                            </small>
                          </td>
                          <td>
                            <strong>
                              {cohort ? String(en ? cohort.titleEn || cohort.titleAr : cohort.titleAr || cohort.titleEn) : en ? "Cohort unavailable" : "الدفعة غير متاحة"}
                            </strong>
                            {cohort?.cohortCode ? <small className="cohort-code-badge">{String(cohort.cohortCode)}</small> : null}
                          </td>
                          <td>
                            <span className={`status-badge status-badge--${String(row.status || "").toLowerCase().replace("_", "-")}`}>
                              {bookingStates[String(row.status)] || String(row.status)}
                            </span>
                            {row.status === "PENDING" && (
                              <button
                                style={{ marginInlineStart: "8px", fontSize: "11px", padding: "4px 8px" }}
                                className="btn-export"
                                disabled={busy}
                                onClick={() => void cancel(row.id)}
                              >
                                {en ? "Cancel" : "إلغاء"}
                              </button>
                            )}
                          </td>
                          <td>
                            <strong style={{ color: "var(--sea-primary)" }}>{Number(row.amountMinor) / 100} SAR</strong>
                          </td>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <td>
                        <time>{Number.isFinite(Number(row.updatedAt)) ? new Intl.DateTimeFormat(en ? "en" : "ar", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(Number(row.updatedAt)) : "—"}</time>
                      </td>
                      <td><strong>{String(row.bookingNumber || (en ? "Booking unavailable" : "الحجز غير متاح"))}</strong><small>{String(row.learnerName || "")}</small></td>
                      <td>
                        <span className={`status-badge status-badge--${String(row.status || "").toLowerCase().replace("_", "-")}`}>
                          {String(row.status)}
                        </span>
                        {row.refundRequired === true && <strong style={{ color: "#b91c1c", marginInlineStart: "6px" }}>{en ? "Refund required" : "يلزم استرجاع"}</strong>}
                      </td>
                      <td>
                        <strong style={{ color: "var(--sea-primary)" }}>{Number(row.amountMinor) / 100} SAR</strong>
                      </td>
                      <td>
                        <button className="btn-export" disabled={busy} onClick={() => void reconcile(row.id)}>
                          {en ? "Verify" : "تحقق"}
                        </button>
                        {["paid", "captured", "refunded"].includes(String(row.status)) && Number(row.refundedMinor || 0) < Number(row.amountMinor) && (
                          <button className="btn-export" style={{ color: "#b91c1c", borderColor: "#fecaca" }} disabled={busy} onClick={() => void refund(row.id)}>
                            {en ? "Refund" : "استرجاع"}
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  {busy ? (en ? "Loading records…" : "جارٍ تحميل السجلات…") : en ? "No records found" : "لا توجد سجلات مطابقة"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cursor && (
        <button className="btn-export" style={{ margin: "16px auto", display: "block" }} disabled={busy} onClick={() => void load(cursor)}>
          {en ? "Load more" : "تحميل المزيد"}
        </button>
      )}

      {/* Cohort Editor Form */}
      {collection === "cohorts" && (
        <form id="cohort-editor" className="training-form cohort-editor" onSubmit={save}>
          <div className="cohort-editor-heading"><PlusCircle size={22} /><h2>{form.id ? en ? "Edit cohort" : "تعديل الدفعة التدريبية" : en ? "Create new cohort" : "إضافة دفعة تدريبية جديدة"}</h2></div>
          <ContentAssistant key={form.id || "new"} collection="cohorts" value={form} baseline={savedForm} english={en} available={aiAvailable} metadata={translationState} reviewed={reviewedTranslations} onReview={setReviewedTranslations} onChange={next => { setForm(next as unknown as typeof empty); setReviewedTranslations([]); }} request={request}>
          <div className="cohort-source"><label>
              {en ? "Program" : "البرنامج الأكاديمي"}
              <select
                ref={programPicker}
                required
                disabled={!!form.id || catalogLoading}
                value={form.programId ? form.programCollection + "/" + form.programId : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setForm((v) => ({ ...v, programCollection: "programs", programId: "" }));
                    return;
                  }
                  const [programCollection, programId] = val.split("/");
                  setForm((v) => ({ ...v, programCollection, programId }));
                  setNotice("");
                }}
              >
                <option value="">{catalogLoading ? en ? "Loading programs and courses…" : "جارٍ تحميل البرامج والدورات…" : en ? "Choose a published program or course" : "اختر برنامجاً أو دورة منشورة"}</option>
                {programs.map((p) => (
                  <option key={String(p.collection) + "/" + p.id} value={String(p.collection) + "/" + p.id}>
                    {String((p.locales as Record<string, { title: string }>)?.[en ? "en" : "ar"]?.title || (p.locales as Record<string, { title?: string }>)?.[en ? "ar" : "en"]?.title || (en ? "Untitled program" : "برنامج بلا عنوان"))}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="admin-secondary-button cohort-autofill" disabled={busy || catalogLoading} onClick={autoFillCohort}><Sparkles size={16} />{en ? "Auto-fill from course" : "تعبئة من الدورة"}</button></div>
          <p className="cohort-source-hint">{en ? "Choose a course, then fill its cohort name in both languages and suggest a code." : "اختر الدورة ثم عبّئ اسم الدفعة باللغتين واقترح رمزها."}</p>
          {catalogError && <p role="alert" className="form-error">{en ? "Some course lists could not load." : "تعذر تحميل بعض قوائم الدورات."} <button type="button" className="text-link" onClick={() => setCatalogRetry(value => value + 1)}>{en ? "Retry" : "إعادة المحاولة"}</button></p>}
          {!catalogLoading && !catalogError && !programs.length && <p className="cohort-source-hint">{en ? "Publish a program or course first to create its cohort." : "انشر برنامجاً أو دورة أولاً لتتمكن من إضافة دفعة."}</p>}
          <div className="cohort-name-fields" ref={nameFields}>{textInput("cohortCode", en ? "Cohort code" : "رمز الدفعة")}<BilingualField fieldKey="title" label={en ? "Cohort title" : "اسم الدفعة"} required /></div>
          <div className="training-input-grid">

            {textInput("price", en ? "Fee in SAR (e.g. 1)" : "الرسوم بالريال السعودي", "number")}
            {textInput("capacity", en ? "Capacity (e.g. 25)" : "السعة القصوى للمقاعد", "number")}
            {textInput("start", en ? "Starts (Riyadh Time)" : "البداية بتوقيت الرياض", "datetime-local")}
            {textInput("end", en ? "Ends (Riyadh Time)" : "النهاية بتوقيت الرياض", "datetime-local")}

            <label>
              {en ? "Delivery Mode" : "نمط التدريب"}
              <select value={form.locationType} onChange={(e) => setForm((v) => ({ ...v, locationType: e.target.value }))}>
                <option value="in_person">{en ? "On campus (حضوري)" : "حضوري (في المقر)"}</option>
                <option value="remote">{en ? "Online (عن بُعد)" : "عن بُعد (عبر الإنترنت)"}</option>
              </select>
            </label>


          </div>

          <div className="cohort-bilingual-fields"><BilingualField fieldKey="schedule" label={en ? "Schedule" : "الجدول"} multiline required /><BilingualField fieldKey="venue" label={en ? "Venue" : "الموقع"} required /></div></ContentAssistant>
          {cohortReview && <section className="publish-review"><h3>{en ? "Review cohort details" : "مراجعة بيانات الدفعة"}</h3><div className="publish-language-preview"><div dir="rtl"><strong>{form.titleAr}</strong><p>{form.scheduleAr}</p><p>{form.venueAr}</p></div><div dir="ltr"><strong>{form.titleEn}</strong><p>{form.scheduleEn}</p><p>{form.venueEn}</p></div></div><p>{form.price} SAR · {form.capacity} {en ? "seats" : "مقاعد"}</p><p dir="ltr">{form.start} — {form.end} (Asia/Riyadh)</p><label className="publish-confirm"><input type="checkbox" checked={cohortReviewed} onChange={e => setCohortReviewed(e.target.checked)} />{en ? "I confirmed both languages, fee, dates, venue and capacity." : "راجعت اللغتين والرسوم والمواعيد والموقع والسعة."}</label><button type="button" className="button button--primary" disabled={busy || !cohortReviewed} onClick={e => void save(e, true)}>{en ? "Publish reviewed cohort" : "نشر الدفعة المراجعة"}</button></section>}
          <label className="training-consent" style={{ marginTop: "12px" }}>
            <input type="checkbox" checked={form.registrationOpen} onChange={(e) => setForm((v) => ({ ...v, registrationOpen: e.target.checked }))} />
            <span>{en ? "Allow online registration (Open for booking)" : "تفعيل وإتاحة الحجز الإلكتروني فوراً (فتح التسجيل)"}</span>
          </label>

          <div className="button-row">
            <button className="button button--primary" disabled={busy}>
              {en ? "Save draft" : "حفظ مسودة"}
            </button>
            <button type="button" className="btn-export" onClick={() => setCohortReview(v => !v)}>{en ? "Preview / Review & publish" : "معاينة / مراجعة ونشر"}</button>
            <button type="button" className="btn-export" onClick={() => { if (JSON.stringify(form) === JSON.stringify(savedForm) || window.confirm(en ? "Discard unsaved changes?" : "تجاهل التعديلات غير المحفوظة؟")) { setForm(empty); setSavedForm(empty); setCohortReview(false); } }}>
              {en ? "Clear" : "إلغاء"}
            </button>
          </div>
          <p className="training-note">{en ? "Fees and capacity changes apply to future bookings only." : "الرسوم والسعة المحددة تنطبق على الحجوزات القادمة، وتحتفظ الحجوزات السابقة بأسعارها."}</p>
        </form>
      )}
    </div>
  );
}
