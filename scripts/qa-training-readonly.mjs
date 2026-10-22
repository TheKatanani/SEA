const base = (process.env.QA_SITE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
let passed = 0;
async function check(path, expected, init = {}) {
  const response = await fetch(base + path, { ...init, cache: "no-store" });
  if (!expected.includes(response.status)) throw new Error(path + ": expected " + expected + ", got " + response.status);
  passed++; return response;
}
await check("/api/health", [200]);
for (const path of ["/api/admin/training", "/api/admin/training?overview=true", "/api/admin/training/export?collection=bookings&format=xlsx", "/api/admin/versions?collection=pages&id=about"]) await check(path, [401, 403]);
for (const path of ["/api/admin/training/payments", "/api/admin/training/bookings"]) await check(path, [401, 403], { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
for (const collection of ["bookings", "payments", "cohorts", "payment_events", "content_drafts"]) await check("/api/site/content?collection=" + collection, [404]);
await check("/api/bookings/does-not-exist", [403], { headers: { Authorization: "Bearer invalid" } });
await check("/api/jobs/training", [401], { method: "POST" });
await check("/api/webhooks/moyasar", [401, 400, 503], { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
for (const prefix of ["", "/en"]) {
  await check(prefix + "/admin", [200]);
  await check(prefix + "/booking/callback", [200]);
  await check(prefix + "/booking/confirmation/nonexistent", [200]);
}
console.log("Passed " + passed + " read-only training / permission / private-data checks. No records created and no payment requested.");

