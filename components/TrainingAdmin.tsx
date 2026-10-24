"use client";
import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { Layers, Users, CreditCard, CheckCircle2, Clock, FileSpreadsheet, FileText, AlertCircle, RefreshCw, XCircle, Search, PlusCircle, Check, Sparkles } from "lucide-react";
import type { PublicCohort } from "./CohortOptions";

type Row = Record<string, unknown> & { id: string };
const empty = { programCollection: "programs", programId: "", cohortCode: "", titleAr: "", titleEn: "", price: "", start: "", end: "", scheduleAr: "", scheduleEn: "", locationType: "in_person", venueAr: "فرع الربوة - الرياض", venueEn: "Al-Rabwah Campus, Riyadh", capacity: "25", status: "draft", registrationOpen: false, id: "" };
const localDate = (value: string) => new Date(Date.parse(value) + 3 * 3600000).toISOString().slice(0, 16);

export function TrainingAdmin({ user, english: en }: { user: User; english: boolean }) {
  const [collection, setCollection] = useState("cohorts");
  const [items, setItems] = useState<Row[]>([]);
  const [programs, setPrograms] = useState<Row[]>([]);
  const [allCohorts, setAllCohorts] = useState<Row[]>([]);
  const [form, setForm] = useState(empty);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cohortFilter, setCohortFilter] = useState("");
  const [cohortQuery, setCohortQuery] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [overview, setOverview] = useState<Record<string, number>>({});
  const [setup, setSetup] = useState<{ bookingReady: boolean; missing: string[]; demo: boolean; applicationsEnabled: boolean; webhookConfigured: boolean } | null>(null);

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
    request("/api/admin/training?overview=true").then(setOverview).catch(() => {});
    request("/api/admin/training?setup=true").then(setSetup).catch(() => {});
    Promise.all(
      ["programs", "courses"].map(async (c) => {
        const r = await request("/api/admin/data?collection=" + c);
        return (r.items as Row[]).filter((p) => p.status === "published").map((p) => ({ ...p, collection: c }));
      })
    )
      .then((groups) => setPrograms(groups.flat()))
      .catch(() => {});
    request("/api/admin/training?collection=cohorts")
      .then((r) => {
        if (Array.isArray(r.items)) setAllCohorts(r.items);
      })
      .catch(() => {});
  }, [request]);

  function autoFillCohort(programCollection: string, programId: string) {
    if (!programId) return;
    const program = programs.find((p) => p.collection === programCollection && p.id === programId);
    if (!program) return;

    const locales = program.locales as Record<string, { title?: string }> | undefined;
    const programTitleAr = locales?.ar?.title || String(program.title || program.id);
    const programTitleEn = locales?.en?.title || String(program.name || program.title || program.id);

    // Calculate cohort count for this program to set sequential ordinal
    const existing = allCohorts.filter(
      (c) => String(c.programId) === programId || (c.programCollection === programCollection && String(c.programId) === programId)
    );
    const cohortNum = existing.length + 1;
    const arabicOrdinals = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
    const ordinalAr = arabicOrdinals[cohortNum - 1] || `رقم ${cohortNum}`;

    // Derive concise cohort code (e.g. course-crowd -> CRD-01)
    const baseCode = programId.replace(/^(course|program)-/, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const prefix = baseCode.slice(0, 3) || "SEA";
    const cohortCode = `${prefix}-0${cohortNum}`;

    // Target start date: next Sunday at 09:00 AM Riyadh time
    const targetStart = new Date();
    const daysUntilSunday = ((7 - targetStart.getDay()) % 7) || 7;
    targetStart.setDate(targetStart.getDate() + daysUntilSunday);
    targetStart.setHours(9, 0, 0, 0);
    const startIso = new Date(targetStart.getTime() + 3 * 3600000).toISOString().slice(0, 16);

    // Target end date: 4 weeks after start date at 15:00 Riyadh time
    const targetEnd = new Date(targetStart);
    targetEnd.setDate(targetEnd.getDate() + 28);
    targetEnd.setHours(15, 0, 0, 0);
    const endIso = new Date(targetEnd.getTime() + 3 * 3600000).toISOString().slice(0, 16);

    setForm((current) => ({
      ...current,
      id: current.id || "",
      programCollection,
      programId,
      cohortCode: current.cohortCode && current.id ? current.cohortCode : cohortCode,
      titleAr: `الدفعة ${ordinalAr} - ${programTitleAr}`,
      titleEn: `Cohort ${cohortNum} - ${programTitleEn}`,
      price: current.price || (setup?.demo ? "1" : "1500"),
      capacity: current.capacity || "25",
      start: current.start || startIso,
      end: current.end || endIso,
      scheduleAr: current.scheduleAr || "الأحد إلى الخميس • 9:00 ص - 3:00 م",
      scheduleEn: current.scheduleEn || "Sunday to Thursday • 9:00 AM - 3:00 PM",
      locationType: "in_person",
      venueAr: "مقر الأكاديمية - فرع الربوة، الرياض",
      venueEn: "SEA Campus - Al-Rabwah, Riyadh",
      status: "published",
      registrationOpen: true,
    }));

    setNotice(
      en
        ? `✨ Auto-filled data for "${programTitleEn}". You can edit any field before saving.`
        : `✨ تم تعبئة البيانات المقترحة تلقائياً لـ "${programTitleAr}". يمكنك تعديل أي حقل قبل الحفظ.`
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("/api/admin/training", {
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
          status: form.status,
          registrationOpen: form.registrationOpen,
        }),
      });
      setNotice(en ? "Cohort saved successfully" : "حُفظت الدفعة بنجاح");
      setForm(empty);
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

  function edit(row: Row) {
    const c = row as unknown as PublicCohort;
    setForm({
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
    });
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
      {setup && (
        <section className="training-setup" aria-label={en ? "Booking setup" : "جاهزية الحجز"}>
          <h2>
            {en ? "Booking setup" : "جاهزية الحجز"}
            {setup.demo ? (en ? " · Sandbox" : " · تجريبي") : ""}
          </h2>
          <p>
            {setup.bookingReady
              ? en
                ? "Payment configuration is active. Publish a cohort and enable registration to open online booking."
                : "إعدادات الدفع جاهزة ونشطة. انشر دفعة وافتح تسجيلها ليظهر زر الحجز في صفحة البرنامج."
              : en
              ? "Complete these deployment settings to enable booking:"
              : "أكمل إعدادات بيئة النشر التالية لتفعيل زر الحجز:"}
          </p>
          {setup.missing.length > 0 && (
            <ul>
              {setup.missing.map((key) => (
                <li key={key}>
                  <code>{key}</code>
                </li>
              ))}
            </ul>
          )}
          {!setup.webhookConfigured && <p>{en ? "Moyasar webhook secret is not configured yet (optional for testing)." : "لم يُضبط سر إشعارات ميسر بعد (اختياري للاختبار)."}</p>}
          {!setup.applicationsEnabled && <p>{en ? "Interest submissions are disabled (APPLICATIONS_ENABLED)." : "استقبال نماذج الاهتمام معطل (APPLICATIONS_ENABLED)."}</p>}
        </section>
      )}

      {/* Executive Metric Cards */}
      <div className="training-metrics">
        <article>
          <div className="metric-icon-wrap metric-icon-wrap--cohorts">
            <Layers size={22} />
          </div>
          <div className="metric-body">
            <span>{en ? "Cohorts" : "الدفعات التدريبية"}</span>
            <strong>{overview.cohorts ?? "—"}</strong>
          </div>
        </article>

        <article>
          <div className="metric-icon-wrap metric-icon-wrap--confirmed">
            <CheckCircle2 size={22} />
          </div>
          <div className="metric-body">
            <span>{en ? "Confirmed Seats" : "المقاعد المؤكدة"}</span>
            <strong style={{ color: "#16a34a" }}>{overview.confirmed ?? "—"}</strong>
          </div>
        </article>

        <article>
          <div className="metric-icon-wrap metric-icon-wrap--pending">
            <Clock size={22} />
          </div>
          <div className="metric-body">
            <span>{en ? "Active Holds" : "حجوزات مؤقتة"}</span>
            <strong>{overview.pending ?? "—"}</strong>
          </div>
        </article>

        <article>
          <div className="metric-icon-wrap metric-icon-wrap--revenue">
            <CreditCard size={22} />
          </div>
          <div className="metric-body">
            <span>{en ? "Net Payments" : "صافي المدفوعات"}</span>
            <strong>{new Intl.NumberFormat(en ? "en-SA" : "ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format((overview.revenueMinor || 0) / 100)}</strong>
          </div>
        </article>
      </div>

      {/* Segmented Tabs Navigation */}
      <nav className="training-tabs" aria-label={en ? "Training management" : "إدارة التدريب"}>
        <button
          className={collection === "cohorts" ? "is-active" : ""}
          onClick={() => {
            setCollection("cohorts");
            setStatus("");
            setAppliedQ("");
            setQ("");
            setCohortFilter("");
            setCohortQuery("");
          }}
        >
          <Layers size={16} />
          <span>{en ? "Cohorts & Capacity" : "الدفعات والسعة"}</span>
        </button>
        <button
          className={collection === "bookings" ? "is-active" : ""}
          onClick={() => {
            setCollection("bookings");
            setStatus("");
            setAppliedQ("");
            setQ("");
            setCohortFilter("");
            setCohortQuery("");
          }}
        >
          <Users size={16} />
          <span>{en ? "Bookings & Registrants" : "الحجوزات والمسجلون"}</span>
        </button>
        <button
          className={collection === "payments" ? "is-active" : ""}
          onClick={() => {
            setCollection("payments");
            setStatus("");
            setAppliedQ("");
            setQ("");
            setCohortFilter("");
            setCohortQuery("");
          }}
        >
          <CreditCard size={16} />
          <span>{en ? "Payments" : "المدفوعات"}</span>
        </button>
      </nav>

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
            <input
              aria-label={en ? "Cohort ID" : "معرّف الدفعة"}
              placeholder={en ? "Cohort ID (optional)" : "معرّف الدفعة (اختياري)"}
              value={cohortQuery}
              onChange={(e) => setCohortQuery(e.target.value)}
            />
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
                ? ["Payment ID", "Booking Ref", "Status", "Amount", "Action"]
                : ["معرّف العملية", "رقم الحجز", "الحالة", "المبلغ", "الإجراء"]
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
                        <button className="btn-export" onClick={() => edit(row)}>
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
                              {cohort ? String(en ? cohort.titleEn || cohort.titleAr : cohort.titleAr || cohort.titleEn) : String(row.cohortId)}
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
                        <strong className="receipt-number-badge" style={{ fontSize: "12px" }}>{row.id}</strong>
                      </td>
                      <td>{String(row.bookingId)}</td>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <PlusCircle size={22} style={{ color: "var(--sea-primary)" }} />
              <h2 style={{ margin: "0" }}>{form.id ? (en ? "Edit Cohort" : "تعديل الدفعة التدريبية") : en ? "Create New Cohort" : "إضافة دفعة تدريبية جديدة"}</h2>
            </div>
            <button
              type="button"
              className="btn-autofill"
              disabled={!form.programId}
              onClick={() => autoFillCohort(form.programCollection, form.programId)}
              title={en ? "Auto-fill suggested data for the selected course" : "تعبئة مقترحة لبيانات الدفعة استناداً إلى الدورة المختارة"}
            >
              <Sparkles size={16} />
              {en ? "Auto-fill from Course" : "تعبئة تلقائية ذكية (حسب الدورة)"}
            </button>
          </div>

          <div className="training-input-grid">
            <label>
              {en ? "Program" : "البرنامج الأكاديمي"}
              <select
                required
                disabled={!!form.id}
                value={form.programId ? form.programCollection + "/" + form.programId : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setForm((v) => ({ ...v, programCollection: "programs", programId: "" }));
                    return;
                  }
                  const [programCollection, programId] = val.split("/");
                  setForm((v) => ({ ...v, programCollection, programId }));
                  if (!form.id) {
                    autoFillCohort(programCollection, programId);
                  }
                }}
              >
                <option value="">{en ? "Choose published program" : "اختر برنامجاً منشوراً"}</option>
                {programs.map((p) => (
                  <option key={String(p.collection) + "/" + p.id} value={String(p.collection) + "/" + p.id}>
                    {String((p.locales as Record<string, { title: string }>)?.[en ? "en" : "ar"]?.title || p.id)}
                  </option>
                ))}
              </select>
            </label>
            {textInput("cohortCode", en ? "Cohort Code (e.g. CRD-01)" : "رمز الدفعة (مثال: CRD-01)")}
            {textInput("titleAr", "اسم الدفعة بالعربية")}
            {textInput("titleEn", "Cohort title in English")}
            {textInput("price", en ? "Fee in SAR (e.g. 1)" : "الرسوم بالريال السعودي", "number")}
            {textInput("capacity", en ? "Capacity (e.g. 25)" : "السعة القصوى للمقاعد", "number")}
            {textInput("start", en ? "Starts (Riyadh Time)" : "البداية بتوقيت الرياض", "datetime-local")}
            {textInput("end", en ? "Ends (Riyadh Time)" : "النهاية بتوقيت الرياض", "datetime-local")}
            {textInput("scheduleAr", "الجدول بالعربية (مثال: الأحد إلى الخميس 9-3)")}
            {textInput("scheduleEn", "Schedule in English")}
            <label>
              {en ? "Delivery Mode" : "نمط التدريب"}
              <select value={form.locationType} onChange={(e) => setForm((v) => ({ ...v, locationType: e.target.value }))}>
                <option value="in_person">{en ? "On campus (حضوري)" : "حضوري (في المقر)"}</option>
                <option value="remote">{en ? "Online (عن بُعد)" : "عن بُعد (عبر الإنترنت)"}</option>
              </select>
            </label>
            <label>
              {en ? "Publication Status" : "حالة النشر"}
              <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
                <option value="draft">{en ? "Draft (مسودة)" : "مسودة"}</option>
                <option value="published">{en ? "Published (منشور للجمهور)" : "منشور (للجمهور)"}</option>
              </select>
            </label>
            {textInput("venueAr", "المقر بالعربية (مثال: فرع الربوة - الرياض)")}
            {textInput("venueEn", "Location in English")}
          </div>

          <label className="training-consent" style={{ marginTop: "12px" }}>
            <input type="checkbox" checked={form.registrationOpen} onChange={(e) => setForm((v) => ({ ...v, registrationOpen: e.target.checked }))} />
            <span>{en ? "Allow online registration (Open for booking)" : "تفعيل وإتاحة الحجز الإلكتروني فوراً (فتح التسجيل)"}</span>
          </label>

          <div className="button-row">
            <button className="button button--primary" disabled={busy}>
              {en ? "Save Cohort" : "حفظ الدفعة"}
            </button>
            <button type="button" className="btn-export" onClick={() => setForm(empty)}>
              {en ? "Clear" : "إلغاء"}
            </button>
          </div>
          <p className="training-note">{en ? "Fees and capacity changes apply to future bookings only." : "الرسوم والسعة المحددة تنطبق على الحجوزات القادمة، وتحتفظ الحجوزات السابقة بأسعارها."}</p>
        </form>
      )}
    </div>
  );
}
