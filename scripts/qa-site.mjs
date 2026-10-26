const baseUrl = (process.env.QA_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const locales = ["ar", "en"];
const paths = [
  "/", "/about", "/programs", "/admission", "/apply", "/employers", "/gallery",
  "/accreditation", "/accreditation/academie-paris", "/partners", "/partners/cote-dazur",
  "/student-journey", "/policies", "/support", "/contact", "/news", "/academic-calendar",
  "/faq", "/careers", "/campaigns/future-diploma", "/programs/crowd-management",
  "/courses/conference-organization", "/policies/privacy",
];
const checks = [];
const fail = (message) => { throw new Error(message); };

function localizedPath(locale, path) {
  const prefix = locale === "en" ? "/en" : "";
  return `${baseUrl}${prefix}${path === "/" ? "/" : path}`;
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function verifyPublishedPage(locale, path) {
  const query = new URLSearchParams({ path, locale });
  const { response: apiResponse, body } = await getJson(`/api/site/page?${query}`);
  if (!apiResponse.ok || body?.state !== "published") fail(`${locale} ${path}: CMS API returned ${apiResponse.status}/${body?.state}.`);
  const response = await fetch(localizedPath(locale, path), { cache: "no-store" });
  const html = await response.text();
  if (!response.ok) fail(`${locale} ${path}: page returned HTTP ${response.status}.`);
  if (/Application error|Internal Server Error|This page is being reviewed/i.test(html)) fail(`${locale} ${path}: rendered an error or review placeholder.`);
  if (!html.includes(`lang="${locale}"`)) fail(`${locale} ${path}: document language metadata is missing.`);
  checks.push(`${locale} ${path}`);
  return response;
}

for (const locale of locales) {
  for (const path of paths) await verifyPublishedPage(locale, path);
  const home = await fetch(localizedPath(locale, "/"), { cache: "no-store" });
  const homeHtml = await home.text();
  const localizedProgramHeading = locale === "en" ? "Explore our programs" : "اكتشف البرامج التدريبية";
  if (!homeHtml.includes("home-hero__photo") || !homeHtml.includes(localizedProgramHeading)) fail(`${locale} home page: the localized hero image or CMS-driven programs are missing.`);
  if (homeHtml.includes("Hero Banner") || homeHtml.includes("Strategic & Academic Partners Strip")) fail(`${locale} home page: editor-only placeholder headings are visible.`);

  const programsHtml = await (await fetch(localizedPath(locale, "/programs"), { cache: "no-store" })).text();
  if (!programsHtml.includes("program-card__link") || !programsHtml.includes("/programs/crowd-management")) fail(`${locale} programs page: program cards or detail links are missing.`);
  const programDetailHtml = await (await fetch(localizedPath(locale, "/programs/crowd-management"), { cache: "no-store" })).text();
  if (!programDetailHtml.includes(locale === "en" ? "Book your seat" : "احجز مقعدك") || !programDetailHtml.includes("cohorts-crowd-management") || !programDetailHtml.includes('id="interest-form"')) fail(`${locale} program detail: booking entry or the secondary interest form is missing.`);
}

for (const collection of ["programs", "courses", "gallery", "faqs", "partners", "policies", "support", "admissions", "resources", "calendar", "forms"]) {
  const { response, body } = await getJson(`/api/site/content?collection=${encodeURIComponent(collection)}`);
  if (!response.ok || !Array.isArray(body?.items)) fail(`${collection}: public content API returned ${response.status}.`);
  if (body.items.some((item) => item.status !== "published")) fail(`${collection}: draft data leaked into the public API.`);
}

const { response: formsResponse, body: formsBody } = await getJson("/api/site/content?collection=forms");
const forms = new Map((formsBody?.items || []).map((item) => [item.id, item]));
for (const type of ["quick_interest", "application_interest", "employer_inquiry", "future_diploma_interest", "contact_inquiry"]) {
  const form = forms.get(type);
  if (!formsResponse.ok || !form) fail(`${type}: published form is missing.`);
  for (const locale of locales) {
    const fields = form.locales?.[locale]?.fields;
    if (!Array.isArray(fields) || !fields.length) fail(`${type}/${locale}: localized fields are missing.`);
    if (fields.some((field) => field.type === "select" && (!Array.isArray(field.options) || field.options.length === 0))) fail(`${type}/${locale}: a select field has no options.`);
  }
}

const { response: brandResponse, body: brandBody } = await getJson("/api/site/brand");
if (!brandResponse.ok || !brandBody?.brand?.logoUrl) fail("Published brand settings or logo are unavailable.");
if (brandBody.brand.locales?.en?.contact?.address !== "Al-Rabwah Campus, Riyadh, Kingdom of Saudi Arabia" || !brandBody.brand.locales?.ar?.contact?.address) fail("Localized contact details are missing from the published brand record.");
if (!(brandBody.brand.navigation || []).some((item) => item.href === "/partners")) fail("The partners navigation item does not link to the partners directory.");
for (const item of brandBody.brand.navigation || []) {
  const path = item.href;
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) continue;
  for (const locale of locales) await verifyPublishedPage(locale, path);
}

const unknown = await fetch(localizedPath("ar", "/qa-page-that-does-not-exist"), { cache: "no-store" });
if (unknown.status !== 404) fail(`Unknown page should return HTTP 404, received ${unknown.status}.`);

const admin = await fetch(localizedPath("ar", "/admin"), { cache: "no-store" });
const adminHtml = await admin.text();
if (!admin.ok || !adminHtml.includes("admin-login") || adminHtml.includes("site-header")) fail("Admin login route is unavailable or rendered public site chrome.");

const adminApi = await fetch(`${baseUrl}/api/admin/data?collection=pages`, { cache: "no-store" });
if (![401, 403].includes(adminApi.status)) fail(`Unauthenticated admin API should deny access, received HTTP ${adminApi.status}.`);
const cloudinaryDeleteApi = await fetch(`${baseUrl}/api/admin/cloudinary-delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicId: "sea/website/qa-probe" }), cache: "no-store" });
if (![401, 403].includes(cloudinaryDeleteApi.status)) fail(`Unauthenticated Cloudinary delete should be denied, received HTTP ${cloudinaryDeleteApi.status}.`);

const badCollection = await fetch(`${baseUrl}/api/site/content?collection=private_data`, { cache: "no-store" });
if (badCollection.status !== 404) fail(`Invalid public collection should return HTTP 404, received ${badCollection.status}.`);

console.log(`Passed: ${checks.length} published route checks across Arabic and English, including CMS detail links.`);
console.log("Passed: public content, form definitions, and brand endpoints.");
console.log("Passed: unknown route returns 404; admin page is isolated; unauthenticated admin API is denied.");
