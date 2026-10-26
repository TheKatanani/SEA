const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
let now = Date.parse("2026-10-22T09:00:00Z");
const realNow = Date.now; Date.now = () => now;
process.env.BOOKING_ACCESS_SECRET = "testing-only-secret-never-used-in-production-12345";
process.env.MOYASAR_SECRET_KEY = "sk_test_testing_only";
process.env.FIREBASE_OWNER_UID = "owner";
let db; let claims = { uid: "owner" };
class MemoryQuery {
  constructor(db, name, filters = [], order = null, limit = Infinity, cursor = null) { Object.assign(this, { db, name, filters, order, cap: limit, cursor }); }
  doc(id) { return this.db.ref(this.name, id || "generated-" + ++this.db.sequence); }
  where(key, op, value) { return new MemoryQuery(this.db, this.name, [...this.filters, [key, op, value]], this.order, this.cap, this.cursor); }
  orderBy(key, direction) { return new MemoryQuery(this.db, this.name, this.filters, [key, direction], this.cap, this.cursor); }
  limit(cap) { return new MemoryQuery(this.db, this.name, this.filters, this.order, cap, this.cursor); }
  startAfter(cursor) { return new MemoryQuery(this.db, this.name, this.filters, this.order, this.cap, cursor); }
  async get() {
    let docs = [...this.db.rows.keys()].filter(k => k.startsWith(this.name + "/")).map(k => this.db.snapshot(k)).filter(doc => this.filters.every(([key, op, value]) => {
      const actual = key.includes(".") ? key.split(".").reduce((acc, part) => acc?.[part], doc.data()) : doc.data()[key];
      return op === "==" ? actual === value : op === "array-contains" ? actual?.includes(value) : op === "<=" ? actual <= value : op === ">" ? actual > value : op === "in" ? value.includes(actual) : false;
    }));
    if (this.order) { const [key, dir] = this.order; docs.sort((a,b) => { const x=a.data()[key], y=b.data()[key]; return ((x<y?-1:x>y?1:0) * (dir==="desc"?-1:1)) || a.id.localeCompare(b.id); }); }
    if (this.cursor) docs = docs.slice(docs.findIndex(d=>d.id===this.cursor.id)+1);
    docs = docs.slice(0,this.cap); return { docs, size: docs.length, empty: docs.length === 0 };
  }
}
class MemoryDb {
  constructor() { this.rows = new Map(); this.queue = Promise.resolve(); this.sequence = 0; }
  collection(name) { return new MemoryQuery(this, name); }
  getAll(...refs) { return Promise.all(refs.map(ref=>ref.get())); }
  ref(collection, id) {
    const key = collection + "/" + id;
    return { id, key, get: async () => this.snapshot(key), set: async (v, options) => this.set(key, v, options), update: async (v) => this.set(key, v, { merge: true }), delete: async () => this.rows.delete(key) };
  }
  snapshot(key) { const value = this.rows.get(key); return { id: key.split("/").at(-1), exists: value !== undefined, data: () => value === undefined ? undefined : structuredClone(value) }; }
  set(key, value, options) { this.rows.set(key, options?.merge ? { ...this.rows.get(key), ...structuredClone(value) } : structuredClone(value)); }
  runTransaction(callback) {
    const operation = this.queue.then(async () => {
      const writes = []; let writing = false;
      const tx = {
        get: async (ref) => { assert.equal(writing, false, "Firestore requires all reads before writes"); return ref.key ? this.snapshot(ref.key) : ref.get(); },
        set: (ref, value, options) => { writing = true; writes.push(() => this.set(ref.key, value, options)); },
        update: (ref, value) => { writing = true; writes.push(() => this.set(ref.key, value, { merge: true })); },
        create: (ref, value) => { writing = true; if (this.rows.has(ref.key)) throw new Error("already exists"); writes.push(() => this.set(ref.key, value)); },
        delete: (ref) => { writing = true; writes.push(() => this.rows.delete(ref.key)); },
      };
      const result = await callback(tx); for (const write of writes) write(); return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
const modules = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} }; modules.set(filename, module);
  const requireAt = createRequire(filename);
  const localRequire = (name) => {
    if (name === "server-only") return {};
    if (name === "@/lib/firebase/admin" || (name === "./admin" && relative.includes("authorization"))) return { getAdminDb: () => db, isFirebaseAdminConfigured: () => true, getAdminAuth: async () => ({ verifyIdToken: async () => claims }) };
    if (name === "firebase-admin/firestore") return { FieldValue: { serverTimestamp: () => now } };
    if (name === "next/cache") return { revalidatePath() {} };
    if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), name + ".ts")));
    return requireAt(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return module.exports;
}
const domain = load("lib/booking/domain.ts");
const security = load("lib/booking/security.ts");
const service = load("lib/booking/service.ts");
const authorization = load("lib/firebase/authorization.ts");
const adminData = load("app/api/admin/data/route.ts");
function reset(capacity = 1) {
  now = Date.parse("2026-10-22T09:00:00Z"); db = new MemoryDb(); claims = { uid: "owner" };
  db.rows.set("programs/course-one", { status: "published" });
  db.rows.set("cohorts/cohort-one", { id: "cohort-one", programCollection: "programs", programId: "course-one", cohortCode: "SEA-01", titleAr: "دورة اختبار", titleEn: "Test course", priceMinor: 15000, currency: "SAR", startAt: "2027-01-01T09:00:00Z", endAt: "2027-01-02T09:00:00Z", timeZone: "Asia/Riyadh", scheduleAr: "الفترة الصباحية", scheduleEn: "Morning sessions", locationType: "in_person", venueAr: "فرع الربوة", venueEn: "Riyadh", status: "published", registrationOpen: true, capacity, confirmedSeats: 0, holds: {}, createdAt: now, updatedAt: now });
}
const attendee = { fullName: "Test Learner Name", email: "learner@example.invalid", nationalId: "1000000000", mobile: "+966500000000" };
const book = (key, ip = key) => service.createBooking("cohort-one", key, attendee, "ar", ip);
function payment(booking, id = "payment-one", extra = {}) {
  return { id, status: "paid", amount: 15000, currency: "SAR", live: false, refunded: 0, metadata: { booking_id: booking.id, checkout_reference: security.bookingSignature(booking.id, "payment") }, ...extra };
}
test("40 simultaneous requests cannot sell the last seat more than once", async () => {
  reset(); const results = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => book("request-" + i)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(Object.keys(db.rows.get("cohorts/cohort-one").holds).length, 1);
});
test("repeated request key returns the same booking without another seat", async () => {
  reset(2); const results = await Promise.all(Array.from({ length: 8 }, () => book("same-key")));
  assert.equal(new Set(results.map((r) => r.booking.id)).size, 1);
  assert.equal(Object.keys(db.rows.get("cohorts/cohort-one").holds).length, 1);
});
test("attendee with confirmed seat in a cohort cannot reserve another seat in that cohort", async () => {
  reset(5); const b = await book("first-booking");
  await service.settlePayment(payment(b.booking), "event-confirmed");
  await assert.rejects(
    () => service.createBooking("cohort-one", "second-req", b.booking.attendee, "ar", "127.0.0.1"),
    (err) => err.code === "ALREADY_REGISTERED" && err.status === 409
  );
});
test("expired hold is reusable and late payment goes to refund review", async () => {
  reset(); const first = await book("first"); now += domain.HOLD_MS + 1;
  const second = await book("second"); await service.settlePayment(payment(first.booking), "event-late");
  assert.equal(db.rows.get("bookings/" + first.booking.id).status, "REFUND_PENDING");
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 0);
  assert.ok(db.rows.get("cohorts/cohort-one").holds[second.booking.id] > now);
  await service.settlePayment(payment(second.booking, "payment-two"), "event-two");
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 1);
});
test("webhook and callback replay confirm the seat exactly once", async () => {
  reset(); const b = await book("one");
  await Promise.all(["event-one", "event-one", "callback-one", "another-event"].map((id) => service.settlePayment(payment(b.booking), id)));
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 1);
  assert.equal(db.rows.get("bookings/" + b.booking.id).status, "CONFIRMED");
});
test("a second successful payment never allocates another seat", async () => {
  reset(2); const b = await book("one");
  await service.settlePayment(payment(b.booking), "event-one");
  await service.settlePayment(payment(b.booking, "payment-two"), "event-two");
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 1);
  assert.equal(db.rows.get("bookings/" + b.booking.id).paymentId, "payment-one");
  assert.equal(db.rows.get("payments/payment-two").refundRequired, true);
});
test("wrong currency, amount, binding or mode cannot confirm a booking", async () => {
  for (const extra of [{ amount: 100 }, { currency: "USD" }, { metadata: { booking_id: "forged" } }, { live: true }]) {
    reset(); const b = await book("one");
    await assert.rejects(service.settlePayment(payment(b.booking, "payment-one", extra), "event-bad"));
    assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 0);
  }
});
test("full refund releases the confirmed seat once; duplicate refund leaves primary seat intact", async () => {
  reset(2); const b = await book("one");
  await service.settlePayment(payment(b.booking), "event-one");
  await service.settlePayment(payment(b.booking, "payment-two"), "event-two");
  await service.settlePayment(payment(b.booking, "payment-two", { status: "refunded", refunded: 15000 }), "event-two-refund");
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 1);
  await service.settlePayment(payment(b.booking, "payment-one", { status: "refunded", refunded: 15000 }), "event-refund");
  await service.settlePayment(payment(b.booking, "payment-one", { status: "refunded", refunded: 15000 }), "event-refund-again");
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 0);
  assert.equal(db.rows.get("bookings/" + b.booking.id).status, "REFUNDED");
});
test("capacity cannot shrink below current commitments", async () => {
  reset(3); await book("one"); await book("two");
  assert.throws(() => domain.validateCapacity(db.rows.get("cohorts/cohort-one"), 1, now));
  now += domain.HOLD_MS + 1; assert.doesNotThrow(() => domain.validateCapacity(db.rows.get("cohorts/cohort-one"), 1, now));
});
test("closing registration blocks new bookings and preserves an existing valid hold", async () => {
  reset(2); const b = await book("one"); db.rows.get("cohorts/cohort-one").registrationOpen = false;
  await assert.rejects(book("two")); await service.settlePayment(payment(b.booking), "event-paid");
  assert.equal(db.rows.get("bookings/" + b.booking.id).status, "CONFIRMED");
});
test("booking access signature is specific to the booking and the purpose", () => {
  reset(); assert.doesNotThrow(() => security.assertBookingAccess("one", security.bookingAccessToken("one")));
  assert.throws(() => security.assertBookingAccess("two", security.bookingAccessToken("one")));
  assert.throws(() => security.assertBookingAccess("one", security.bookingSignature("one", "payment")));
});
test("removing or lowering a role overrides stale admin claims", async () => {
  reset(); claims = { uid: "former", admin: true, role: "admin" };
  const request = { headers: new Headers({ Authorization: "Bearer test" }) };
  await assert.rejects(authorization.requireAdmin(request), (e) => e.status === 403);
  db.rows.set("admins/former", { active: true, role: "editor" });
  await assert.rejects(authorization.requireAdmin(request, ["admin"]), (e) => e.status === 403);
  assert.equal((await authorization.requireAdmin(request)).role, "editor");
});
test("audit log DELETE returns 405 without deleting data", async () => {
  reset(); db.rows.set("audit_logs/history", { action: "kept" });
  const response = await adminData.DELETE({ headers: new Headers({ Authorization: "Bearer test" }), nextUrl: new URL("http://localhost/api/admin/data?collection=audit_logs&id=history") });
  assert.equal(response.status, 405); assert.ok(db.rows.has("audit_logs/history"));
});
test("saving a draft keeps the published page; publishing replaces it atomically", async () => {
  reset(); db.rows.set("pages/about", { status: "published", path: "/about", locales: { ar: { title: "قديم" }, en: { title: "Old" } }, createdAt: now });
  const request = (status) => ({ headers: new Headers({ Authorization: "Bearer test" }), nextUrl: new URL("http://localhost/api/admin/data?collection=pages"), json: async () => ({ id: "about", data: { status, path: "/about", locales: { ar: { title: "جديد" }, en: { title: "New" } } }, translationReview: { reviewed: status === "published" ? ["ar:title", "en:title"] : [] } }) });
  assert.equal((await adminData.POST(request("draft"))).status, 200);
  assert.equal(db.rows.get("pages/about").locales.en.title, "Old");
  assert.equal(db.rows.get("content_drafts/pages__about").data.locales.en.title, "New");
  assert.equal((await adminData.POST(request("published"))).status, 200);
  assert.equal(db.rows.get("pages/about").locales.en.title, "New");
  assert.equal(db.rows.has("content_drafts/pages__about"), false);
});
test("public content DTO strips unknown and private nested fields", () => {
  const { publicRecord } = load("lib/public-record.ts");
  assert.deepEqual(publicRecord({ id: "one", status: "published", internalNotes: "private", locales: { ar: { title: "عام", token: "private" } } }), { id: "one", status: "published", locales: { ar: { title: "عام" } } });
});
test("partial refund keeps the seat; a refund arriving before paid never allocates it", async () => {
  reset(); const first = await book("first");
  await service.settlePayment(payment(first.booking), "event-paid");
  await service.settlePayment(payment(first.booking, "payment-one", { status: "refunded", refunded: 5000 }), "event-partial");
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 1);
  reset(); const second = await book("second");
  await service.settlePayment(payment(second.booking, "payment-one", { status: "refunded", refunded: 15000 }), "event-refund-first");
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats, 0);
  assert.equal(db.rows.get("bookings/" + second.booking.id).status, "REFUNDED");
});
test("invalid attendee quantity and extra fields are rejected", () => {
  assert.equal(domain.attendeeSchema.safeParse({ ...attendee, quantity: 2 }).success, false);
  assert.equal(domain.attendeeSchema.safeParse({ ...attendee, nationalId: "123" }).success, false);
});
test("CSV and XLSX export every matching row beyond 100 and neutralize formulas", async () => {
  reset();
  for(let i=0;i<130;i++) db.rows.set("bookings/registrant-"+i, { id:"registrant-"+i,bookingNumber:"SEA-"+i,attendee:{...attendee,fullName:i===0?"=2+2":"Learner "+i},cohortId:"cohort-one",status:"CONFIRMED",amountMinor:15000,createdAt:now+i,searchTokens:["learner"] });
  const exporter=load("app/api/admin/training/export/route.ts");
  const request=(format)=>({headers:new Headers({Authorization:"Bearer test"}),nextUrl:new URL("http://localhost/api/admin/training/export?collection=bookings&status=CONFIRMED&format="+format)});
  const csv=await exporter.GET(request("csv"));assert.equal(csv.status,200);const text=await csv.text();assert.equal(text.trim().split("\r\n").length,131);assert.ok(text.includes("'=2+2"));
  const xlsx=await exporter.GET(request("xlsx"));assert.equal(xlsx.status,200);const ExcelJS=require("exceljs");const wb=new ExcelJS.Workbook();await wb.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));assert.equal(wb.worksheets[0].rowCount,131);
  claims={uid:"editor"};db.rows.set("admins/editor",{active:true,role:"editor"});assert.equal((await exporter.GET(request("csv"))).status,403);
});
test("cohort creation enforces a unique code under concurrent requests", async () => {
  reset(); const { id,confirmedSeats,holds,createdAt,updatedAt,...input }=db.rows.get("cohorts/cohort-one");
  const results=await Promise.allSettled([service.saveCohort({...input,cohortCode:"NEW-2027"},"owner"),service.saveCohort({...input,cohortCode:"NEW-2027"},"owner")]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
});
test("expired booking links cannot reveal a receipt", () => {
  reset(); const token=security.bookingAccessToken("one",now+1000);now+=1001;assert.throws(()=>security.assertBookingAccess("one",token));
});
test("unknown refund outcome never repeats a money-moving request", async () => {
  reset();const b=await book("one");await service.settlePayment(payment(b.booking),"paid-before-refund");
  const {refundPayment}=load("lib/payments/refund.ts");const originalFetch=global.fetch;let posts=0;
  global.fetch=async(url,options)=>{if(options?.method==="POST"){posts++;throw new Error("Simulated network interruption");}return new Response(JSON.stringify(payment(b.booking)),{status:200});};
  try {await assert.rejects(refundPayment("payment-one","owner"));await assert.rejects(refundPayment("payment-one","owner"));assert.equal(posts,1);assert.equal(db.rows.get("payments/payment-one").refundState,"unknown");assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats,1);}finally{global.fetch=originalFetch;}
});
test("cancelling a pending booking releases its seat and logs the action", async () => {
  reset();const b=await book("one");const api=load("app/api/admin/training/bookings/route.ts");
  const response=await api.POST({headers:new Headers({Authorization:"Bearer test"}),json:async()=>({bookingId:b.booking.id,action:"cancel"})});
  assert.equal(response.status,200);assert.equal(db.rows.get("bookings/"+b.booking.id).status,"CANCELLED");assert.equal(domain.availability(db.rows.get("cohorts/cohort-one"),now).remaining,1);
});
test("Arabic rewrites and both locale prefixes never issue a self-redirect", () => {
  const { NextRequest } = require("next/server"); const middleware = load("middleware.ts").default;
  for (const pathname of ["/", "/about", "/ar/about", "/en/about"]) {
    const response = middleware(new NextRequest("http://localhost:3100" + pathname));
    assert.equal(response.status, 200); assert.equal(response.headers.get("location"), null);
    if (!pathname.startsWith("/ar") && !pathname.startsWith("/en")) assert.ok(new URL(response.headers.get("x-middleware-rewrite")).pathname.startsWith("/ar"));
  }
});
test("older payment snapshots cannot undo a refund or hide a successful charge", async () => {
  reset(); const b=await book("one");
  await service.settlePayment(payment(b.booking),"event-paid-current");
  await service.settlePayment(payment(b.booking,"payment-one",{status:"failed"}),"event-failed-older");
  assert.equal(db.rows.get("payments/payment-one").status,"paid");
  await service.settlePayment(payment(b.booking,"payment-one",{status:"refunded",refunded:15000}),"event-refunded-current");
  await service.settlePayment(payment(b.booking),"event-paid-older");
  assert.equal(db.rows.get("bookings/"+b.booking.id).status,"REFUNDED");
  assert.equal(db.rows.get("payments/payment-one").refundedMinor,15000);
  assert.equal(db.rows.get("cohorts/cohort-one").confirmedSeats,0);
});
async function withEnvironment(values, run) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  try { await run(); } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
test("form readiness prevents collecting details while privacy setup is missing", async () => {
  reset(); const api = load("app/api/applications/route.ts");
  await withEnvironment({ APPLICATIONS_ENABLED: "true", PRIVACY_POLICY_VERSION: "  ", FIREBASE_RATE_LIMIT_SECRET: "synthetic-rate-secret", SITE_DEMO_MODE: "true" }, async () => {
    const readiness = await api.GET(); assert.equal(readiness.status, 200); assert.deepEqual(await readiness.json(), { enabled: false, demo: true });
    const rejected = await api.POST({}); assert.equal(rejected.status, 503); assert.equal((await rejected.json()).error, "Privacy policy is not configured");
    assert.equal([...db.rows.keys()].some(key => key.startsWith("applications/")), false);
    process.env.PRIVACY_POLICY_VERSION = "sandbox-test-policy-v1";
    assert.deepEqual(await (await api.GET()).json(), { enabled: true, demo: true });
  });
});
test("sandbox mode refuses live Moyasar keys and still allows a configured test checkout", async () => {
  await withEnvironment({ SITE_DEMO_MODE: "true", BOOKINGS_ENABLED: "true", PRIVACY_POLICY_VERSION: "sandbox-test-policy-v1", NEXT_PUBLIC_APP_URL: "https://example.invalid", MOYASAR_SECRET_KEY: "sk_live_synthetic_only", NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY: "pk_live_synthetic_only" }, async () => {
    assert.throws(() => security.assertBookingEnabled(), error => error.code === "DEMO_REQUIRES_TEST_KEYS");
    process.env.MOYASAR_SECRET_KEY = "sk_test_synthetic_only"; process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY = "pk_test_synthetic_only";
    assert.doesNotThrow(() => security.assertBookingEnabled());
  });
});
test("booking setup diagnostics require an administrator and never return key values", async () => {
  reset(); const api = load("app/api/admin/training/route.ts");
  const request = { headers: new Headers({ Authorization: "Bearer test" }), nextUrl: new URL("http://localhost/api/admin/training?setup=true") };
  await withEnvironment({ BOOKINGS_ENABLED: "false", PRIVACY_POLICY_VERSION: "pending-approval", NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY: "pk_test_private_fixture" }, async () => {
    const response = await api.GET(request); assert.equal(response.status, 200); const body = await response.json();
    assert.equal(body.bookingReady, false); assert.ok(body.missing.includes("PRIVACY_POLICY_VERSION")); assert.ok(!JSON.stringify(body).includes("pk_test_private_fixture"));
    claims = { uid: "editor" }; db.rows.set("admins/editor", { active: true, role: "editor" });
    assert.equal((await api.GET(request)).status, 403);
  });
});
test.after(() => { Date.now = realNow; });

