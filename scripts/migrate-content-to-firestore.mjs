import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import ts from "typescript";
import { initializeApp, cert } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(root);

function requireTypeScriptModule(relativeFile) {
  const filename = path.join(root, relativeFile);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const moduleRequire = createRequire(pathToFileURL(filename));
  new Function("require", "module", "exports", output)(moduleRequire, module, module.exports);
  return module.exports;
}

const content = requireTypeScriptModule("lib/content.ts");
const englishContent = requireTypeScriptModule("lib/english-content.ts");
const staticPages = requireTypeScriptModule("lib/static-pages.ts");
const audit = JSON.parse(fs.readFileSync(path.join(root, "data/claude-content-payload.json"), "utf8"));
const messages = { ar: JSON.parse(fs.readFileSync(path.join(root, "messages/ar.json"), "utf8")), en: JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8")) };
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");

if (process.argv[2] !== "--apply") {
  console.log("This migration only creates missing Firestore records and Cloudinary assets.");
  console.log("Run with --apply to write the records as drafts.");
  process.exit(0);
}
if (serviceAccount.type !== "service_account" || serviceAccount.project_id !== "sea-website-64e58") throw new Error("Firebase service account is unavailable or belongs to another project.");

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new Error("Cloudinary server credentials are missing.");

const records = [];
const publicAssetUrls = new Map();

function pageId(route) {
  return route.replace(/^\/+|\/+$/g, "").replaceAll("/", "__") || "home";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function put(collection, id, data) {
  records.push({ collection, id, data });
}

async function uploadLocalImage(source) {
  if (publicAssetUrls.has(source)) return publicAssetUrls.get(source);
  const relative = source.replace(/^\/+/, "");
  const filename = path.join(root, "public", relative);
  if (!fs.existsSync(filename)) return "";
  const base = path.basename(filename, path.extname(filename));
  const publicId = `sea/website/migration/${base}`;
  try {
    const result = await cloudinary.uploader.upload(filename, { folder: "sea/website/migration", public_id: base, resource_type: "image", overwrite: false, unique_filename: false });
    publicAssetUrls.set(source, result.secure_url);
    return result.secure_url;
  } catch (error) {
    try {
      const existing = await cloudinary.api.resource(publicId, { resource_type: "image" });
      publicAssetUrls.set(source, existing.secure_url);
      return existing.secure_url;
    } catch {
      throw error;
    }
  }
}

const uniqueImages = new Set([
  ...content.galleryPhotos.map((photo) => photo.src),
  ...content.allProgramPages.map((program) => program.image),
  "/sea-logo-color.png",
  "/sea-logo-white.png",
]);
for (const image of uniqueImages) await uploadLocalImage(image);

for (const [index, program] of content.allProgramPages.entries()) {
  const localizedEnglish = englishContent.localizeProgram(program, true);
  const collection = program.isDiploma ? "programs" : "courses";
  const imageUrl = publicAssetUrls.get(program.image) || "";
  put(collection, program.slug, {
    slug: program.slug,
    href: program.href,
    type: program.isDiploma ? "diploma" : "live",
    isDiploma: program.isDiploma,
    featured: program.isDiploma && index < 4,
    imageUrl,
    source: program.source,
    locales: {
      ar: { title: program.title, description: program.description, category: program.category, status: program.status, duration: program.duration || "", hoursAndSchedule: program.hoursAndSchedule || "", targetAudience: program.targetAudience || "", pillars: asArray(program.pillars), outcomes: program.outcomes || "", careers: program.careers || "", requirements: program.requirements || "", documents: asArray(program.documents) },
      en: { title: localizedEnglish.titleEn || localizedEnglish.title, description: localizedEnglish.description, category: localizedEnglish.category, status: localizedEnglish.status, duration: localizedEnglish.duration || "" },
    },
  });
}

for (const [index, title] of content.recordedShortCourses.entries()) {
  const englishTitle = englishContent.recordedCourseEnglishTitles[index] || "";
  const id = `recorded-${String(index + 1).padStart(2, "0")}`;
  put("courses", id, { slug: id, type: "recorded", format: "recorded", isDiploma: false, locales: { ar: { title, description: "" }, en: { title: englishTitle, description: "" } } });
}

for (const [index, photo] of content.galleryPhotos.entries()) {
  const id = `photo-${String(index + 1).padStart(2, "0")}`;
  const url = publicAssetUrls.get(photo.src) || "";
  if (!url) continue;
  put("gallery", id, { type: "photo", url, imageUrl: url, locales: { ar: { title: photo.caption, caption: photo.caption, alt: photo.alt }, en: { title: englishContent.galleryCaptionsEn[index] || "", caption: englishContent.galleryCaptionsEn[index] || "", alt: englishContent.galleryAltsEn[index] || "" } } });
  put("media", `gallery-${id}`, { status: "draft", publicId: `sea/website/migration/${path.basename(photo.src).replace(/\.[^.]+$/, "")}`, url, resourceType: "image", format: path.extname(photo.src).slice(1), originalName: path.basename(photo.src), alt: { ar: photo.alt, en: englishContent.galleryAltsEn[index] || "" } });
}

for (let index = 0; index < content.faqs.length; index++) {
  const item = content.faqs[index];
  const englishItem = englishContent.faqsEn[index] || {};
  put("faqs", `faq-${String(index + 1).padStart(2, "0")}`, { locales: { ar: { question: item.question, answer: item.answer }, en: { question: englishItem.question || "", answer: englishItem.answer || "" } } });
}

const partnerRecords = audit.partners || [];
let partnerIndex = 0;
for (const group of content.partnerGroups) {
  for (const name of group.names) {
    const source = partnerRecords.find((item) => item.name_ar === name) || partnerRecords[partnerIndex] || {};
    const translatedGroup = englishContent.partnerGroupLabelsEn[group.title] || group.title;
    put("partners", `partner-${String(partnerIndex + 1).padStart(2, "0")}`, {
      website: source.website || "",
      logoUrl: source.logo_url || "",
      usageRights: source.usage_rights || "",
      locales: {
        ar: { title: source.name_ar || name, group: group.title, role: source.role || "" },
        en: { title: source.name_en || englishContent.partnerNameTranslations[name] || "", group: translatedGroup, role: "" },
      },
    });
    partnerIndex++;
  }
}

const auditPages = new Map((audit.pages || []).map((page) => [page.slug_next_proposed || "/", page]));
const routes = [
  ["/", "الرئيسية", "Home"], ["/about", "عن الأكاديمية", "About the Academy"], ["/programs", "البرامج", "Programs"],
  ["/admission", "القبول والتسجيل", "Admission"], ["/apply", "التسجيل", "Apply"], ["/employers", "للمنشآت وأصحاب العمل", "For employers"],
  ["/gallery", "المعرض", "Gallery"], ["/accreditation", "الاعتماد الأكاديمي", "Accreditation"],
  ["/accreditation/academie-paris", "أكاديمية باريس الدولية", "Académie de Paris"], ["/partners", "الشركاء", "Partners"],
  ["/partners/cote-dazur", "جامعة كوت دازور", "Université Côte d’Azur"], ["/student-journey", "رحلة المتدرب", "Student journey"],
  ["/policies", "السياسات واللوائح", "Policies"], ["/support", "الدعم والأدلة", "Support and guides"],
  ["/contact", "تواصل معنا", "Contact"], ["/news", "مكتبة الوثائق", "Document library"],
  ["/academic-calendar", "التقويم الأكاديمي", "Academic calendar"], ["/faq", "الأسئلة الشائعة", "FAQs"],
  ["/careers", "الوظائف والتدريب", "Careers"], ["/campaigns/future-diploma", "دبلوم المستقبل", "Future diploma"],
];

const pageCollections = {
  "/": ["programs", "partners"], "/programs": ["programs", "courses"], "/gallery": ["gallery"],
  "/faq": ["faqs"], "/partners": ["partners"], "/admission": ["admissions"],
  "/policies": ["policies"], "/support": ["support"], "/news": ["resources"],
  "/academic-calendar": ["calendar"],
};
const pageForms = { "/": "quick_interest", "/apply": "application_interest", "/employers": "employer_inquiry", "/campaigns/future-diploma": "future_diploma_interest", "/contact": "contact_inquiry" };

for (const [route, defaultAr, defaultEn] of routes) {
  const source = auditPages.get(route);
  const sectionNames = asArray(source?.sections);
  const arTitle = source?.h1 && !String(source.h1).includes("Missing") ? source.h1 : source?.page_name_ar || defaultAr;
  const enTitle = source?.page_name_en || defaultEn;
  const arDescription = source?.body_summary_ar || source?.h2_ar || source?.hero_text || "";
  const enDescription = source?.body_summary_en || source?.h2_en || "";
  put("pages", pageId(route), {
    path: route,
    source: source?.source || "",
    auditStatus: source?.status || "Needs review",
    locales: {
      ar: { title: arTitle, description: arDescription, seoTitle: arTitle, seoDescription: arDescription, sections: [...sectionNames.map((heading) => ({ heading: String(heading), body: "", type: "text" })), ...(pageCollections[route] || []).map((collection) => ({ heading: collection, type: "collection", collection })), ...(pageForms[route] ? [{ heading: "نموذج التواصل", type: "form", formType: pageForms[route] }] : [])] },
      en: { title: enTitle, description: enDescription, seoTitle: enTitle, seoDescription: enDescription, sections: [...sectionNames.map((heading) => ({ heading: String(heading), body: "", type: "text" })), ...(pageCollections[route] || []).map((collection) => ({ heading: collection, type: "collection", collection })), ...(pageForms[route] ? [{ heading: "Contact form", type: "form", formType: pageForms[route] }] : [])] },
    },
  });
}

for (const program of content.allProgramPages) {
  const route = program.href;
  if (!auditPages.has(route)) put("pages", pageId(route), { path: route, locales: { ar: { title: program.title, description: program.description, sections: [] }, en: { title: program.titleEn || "", description: "", sections: [] } } });
}

for (const policy of staticPages.policyPages) {
  const en = englishContent.policyEnglish[policy.slug] || {};
  put("policies", policy.slug, { source: policy.source, document: policy.document || null, locales: { ar: { title: policy.title, summary: policy.summary, sections: policy.topics.map((heading) => ({ heading, body: "" })) }, en: { title: en.title || "", summary: en.summary || "", sections: (en.topics || []).map((heading) => ({ heading, body: "" })) } } });
  const route = `/policies/${policy.slug}`;
  put("pages", pageId(route), { path: route, locales: { ar: { title: policy.title, description: policy.summary, sections: [...policy.topics.map((heading) => ({ heading, body: "" })), { type: "record", collection: "policies", recordId: policy.slug }] }, en: { title: en.title || "", description: en.summary || "", sections: [...(en.topics || []).map((heading) => ({ heading, body: "" })), { type: "record", collection: "policies", recordId: policy.slug }] } } });
}

for (const guide of staticPages.supportPages) {
  const en = englishContent.supportEnglish[guide.slug] || {};
  put("support", guide.slug, { source: guide.source, locales: { ar: { title: guide.title, sections: guide.topics.map((heading) => ({ heading, body: "" })) }, en: { title: en.title || "", sections: (en.topics || []).map((heading) => ({ heading, body: "" })) } } });
  const route = `/support/${guide.slug}`;
  put("pages", pageId(route), {
    path: route,
    locales: {
      ar: { title: guide.title, sections: [...guide.topics.map((heading) => ({ heading, body: "" })), { type: "record", collection: "support", recordId: guide.slug }] },
      en: { title: en.title || "", sections: [...(en.topics || []).map((heading) => ({ heading, body: "" })), { type: "record", collection: "support", recordId: guide.slug }] },
    },
  });
}

for (const [index, resource] of staticPages.resourceDocuments.entries()) {
  const en = englishContent.resourceDocumentEnglish[resource.title] || {};
  put("resources", `resource-${String(index + 1).padStart(2, "0")}`, { url: resource.href, format: resource.type, locales: { ar: { title: resource.title, category: resource.category }, en: { title: en.title || "", category: en.category || "" } } });
}

const field = (name, label, type = "text", required = false, options = [], full = false) => ({ name, label, type, required, ...(options.length ? { options } : {}), ...(full ? { full: true } : {}) });
const formDefinitions = [
  { id: "quick_interest", ar: { title: "التسجيل السريع", description: "أرسل بياناتك الأولية ليتمكن فريق الأكاديمية من التواصل معك.", buttonLabel: "أرسل اهتمامك", fields: [field("firstName", "الاسم الأول", "text", true), field("lastName", "اسم العائلة"), field("email", "البريد الإلكتروني", "email", true), field("phone", "رقم الجوال", "tel", true), field("city", "المدينة"), field("gender", "الجنس", "select", false, ["ذكر", "أنثى"]), field("message", "رسالتك", "textarea", false, [], true)] }, en: { title: "Quick registration", description: "Share your details so the Academy team can contact you.", buttonLabel: "Send interest", fields: [field("firstName", "First name", "text", true), field("lastName", "Last name"), field("email", "Email address", "email", true), field("phone", "Mobile number", "tel", true), field("city", "City"), field("gender", "Gender", "select", false, ["Male", "Female"]), field("message", "Your message", "textarea", false, [], true)] } },
  { id: "application_interest", ar: { title: "طلب التحاق", description: "أكمل البيانات لإرسال طلب الاهتمام بالالتحاق.", buttonLabel: "إرسال طلب الاهتمام", fields: [field("fullName", "الاسم الكامل", "text", true), field("email", "البريد الإلكتروني", "email", true), field("phone", "رقم الجوال", "tel", true), field("education", "المؤهل العلمي", "select", false, ["ثانوية عامة", "دبلوم", "بكالوريوس أو أعلى"]), field("city", "المدينة", "text", true), field("track", "البرنامج / المسار", "select", true, [] , true)] }, en: { title: "Application", description: "Complete the details to register your interest in admission.", buttonLabel: "Submit application", fields: [field("fullName", "Full name", "text", true), field("email", "Email address", "email", true), field("phone", "Mobile number", "tel", true), field("education", "Education level", "select", false, ["High school", "Diploma", "Bachelor's degree or higher"]), field("city", "City", "text", true), field("track", "Program / track", "select", true, [], true)] } },
  { id: "employer_inquiry", ar: { title: "تسجيل جهة توظيف", description: "سجّل اهتمام منشأتك بالتعاون مع الأكاديمية.", buttonLabel: "إرسال اهتمام المنشأة", fields: [field("company", "اسم المنشأة", "text", true), field("sector", "مجال المنشأة", "text", true), field("contactName", "اسم مسؤول التواصل", "text", true), field("jobTitle", "المسمى الوظيفي", "text", true), field("email", "البريد الإلكتروني للعمل", "email", true), field("phone", "رقم الجوال", "tel", true), field("region", "المدينة / المنطقة", "text", true), field("vacancies", "عدد الشواغر المتوقع"), field("specialties", "التخصصات المطلوبة", "textarea", false, [], true)] }, en: { title: "Employer registration", description: "Register your organisation's interest in working with the Academy.", buttonLabel: "Send employer enquiry", fields: [field("company", "Company name", "text", true), field("sector", "Industry", "text", true), field("contactName", "Contact person", "text", true), field("jobTitle", "Job title", "text", true), field("email", "Work email", "email", true), field("phone", "Mobile number", "tel", true), field("region", "City / region", "text", true), field("vacancies", "Expected vacancies"), field("specialties", "Required specialties", "textarea", false, [], true)] } },
  { id: "future_diploma_interest", ar: { title: "الاهتمام بدبلوم المستقبل", description: "سجّل اهتمامك وسيتم التواصل معك عند توفر تفاصيل التسجيل.", buttonLabel: "سجّل اهتمامك", fields: [field("name", "الاسم الكامل", "text", true), field("phone", "رقم الجوال", "tel", true), field("email", "البريد الإلكتروني", "email", true), field("city", "المدينة")] }, en: { title: "MICE diploma interest", description: "Register your interest and the Academy will contact you with admission details.", buttonLabel: "Register interest", fields: [field("name", "Full name", "text", true), field("phone", "Mobile number", "tel", true), field("email", "Email address", "email", true), field("city", "City")] } },
  { id: "contact_inquiry", ar: { title: "التواصل مع الأكاديمية", description: "أرسل استفسارك وسيتواصل معك الفريق.", buttonLabel: "إرسال استفسار", fields: [field("name", "الاسم", "text", true), field("email", "البريد الإلكتروني", "email", true), field("phone", "رقم الجوال", "tel"), field("subject", "عنوان الاستفسار"), field("message", "الرسالة", "textarea", true, [], true)] }, en: { title: "Contact the Academy", description: "Send your question and the team will get back to you.", buttonLabel: "Send enquiry", fields: [field("name", "Name", "text", true), field("email", "Email address", "email", true), field("phone", "Mobile number", "tel"), field("subject", "Subject"), field("message", "Message", "textarea", true, [], true)] } },
];
for (const form of formDefinitions) put("forms", form.id, { formType: form.id, locales: { ar: form.ar, en: form.en } });

put("calendar", "academic-calendar", { url: staticPages.academicCalendarDocument.href, locales: { ar: { title: staticPages.academicCalendarDocument.title }, en: { title: "Academic calendar" } } });
put("admissions", "main", { locales: { ar: { requirements: content.admissionRequirements, documents: content.requiredDocuments }, en: { requirements: englishContent.admissionRequirementsEn, documents: englishContent.requiredDocumentsEn } } });
put("brand", "main", {
  logoUrl: publicAssetUrls.get("/sea-logo-color.png") || "", footerLogoUrl: publicAssetUrls.get("/sea-logo-white.png") || "", faviconUrl: publicAssetUrls.get("/sea-logo-color.png") || "",
  primaryColor: "#087180", accentColor: "#f1a52d", fontArabic: "IBM Plex Sans Arabic", fontEnglish: "Montserrat",
  socialLinks: Object.fromEntries(content.socialLinks.map((item) => [item.platform, item.href])),
  contact: { address: content.contactDetails.address, postal: content.contactDetails.postal, email: content.contactDetails.email, phone: content.contactDetails.phone, recruitment: content.contactDetails.recruitment, map: content.contactDetails.map },
});

const refs = records.map((record) => ({ ...record, ref: db.collection(record.collection).doc(record.id) }));
const existingSnapshots = await Promise.all(refs.map((record) => record.ref.get()));
const missing = refs.filter((_, index) => !existingSnapshots[index].exists);
let created = 0;
for (let offset = 0; offset < missing.length; offset += 450) {
  const batch = db.batch();
  for (const record of missing.slice(offset, offset + 450)) {
    batch.create(record.ref, { ...record.data, status: "draft", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  created += missing.slice(offset, offset + 450).length;
}

for (const [collection, entries] of [["policies", staticPages.policyPages], ["support", staticPages.supportPages]]) {
  for (const entry of entries) {
    const reference = db.collection("pages").doc(pageId(`/${collection}/${entry.slug}`));
    const snapshot = await reference.get();
    const data = snapshot.data();
    if (!data || data.status !== "draft") continue;
    const locales = data.locales || {};
    const nextLocales = Object.fromEntries(["ar", "en"].map((locale) => {
      const value = locales[locale] || {};
      const sections = Array.isArray(value.sections) ? value.sections : [];
      const hasRecord = sections.some((section) => section.type === "record" && section.collection === collection && section.recordId === entry.slug);
      return [locale, { ...value, sections: hasRecord ? sections : [...sections, { type: "record", collection, recordId: entry.slug }] }];
    }));
    await reference.update({ locales: nextLocales, updatedAt: FieldValue.serverTimestamp() });
  }
}

for (const program of content.allProgramPages) {
  const collection = program.isDiploma ? "programs" : "courses";
  const reference = db.collection("pages").doc(pageId(program.href));
  const snapshot = await reference.get();
  const data = snapshot.data();
  if (!data || data.status !== "draft") continue;
  const locales = data.locales || {};
  const nextLocales = Object.fromEntries(["ar", "en"].map((locale) => {
    const value = locales[locale] || {};
    const sections = Array.isArray(value.sections) ? value.sections : [];
    const hasRecord = sections.some((section) => section.type === "record" && section.collection === collection && section.recordId === program.slug);
    return [locale, { ...value, sections: hasRecord ? sections : [...sections, { type: "record", collection, recordId: program.slug }] }];
  }));
  await reference.update({ locales: nextLocales, updatedAt: FieldValue.serverTimestamp() });
}

const brandReference = db.collection("brand").doc("main");
const brandSnapshot = await brandReference.get();
if (brandSnapshot.exists && brandSnapshot.data()?.status === "draft") {
  const oldBrand = brandSnapshot.data();
  const navRows = [
    ["/", "home"], ["/about", "about"], ["/programs", "programs"], ["/admission", "admission"], ["/employers", "employers"], ["/partners/cote-dazur", "partners"], ["/gallery", "gallery"],
  ];
  const footerRows = [["/admission", "admission"], ["/student-journey", "journey"], ["/support", "support"], ["/policies", "policies"], ["/accreditation/academie-paris", "paris"], ["/contact", "contact"]];
  const navigation = oldBrand.navigation || navRows.map(([href, label], sortOrder) => ({ href, sortOrder, locales: { ar: { label: messages.ar.nav[label] }, en: { label: messages.en.nav[label] } } }));
  const footerLinks = oldBrand.footerLinks || footerRows.map(([href, label], sortOrder) => ({ href, sortOrder, locales: { ar: { label: messages.ar.footer[label] }, en: { label: messages.en.footer[label] } } }));
  const locales = oldBrand.locales || {
    ar: { footer: messages.ar.footer, nav: messages.ar.nav },
    en: { footer: messages.en.footer, nav: messages.en.nav },
  };
  await brandReference.update({
    logoUrl: publicAssetUrls.get("/sea-logo-color.png") || brandSnapshot.data()?.logoUrl || "",
    footerLogoUrl: publicAssetUrls.get("/sea-logo-white.png") || brandSnapshot.data()?.footerLogoUrl || "",
    faviconUrl: publicAssetUrls.get("/sea-logo-color.png") || brandSnapshot.data()?.faviconUrl || "",
    navigation,
    footerLinks,
    locales,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

const counts = missing.reduce((result, record) => ({ ...result, [record.collection]: (result[record.collection] || 0) + 1 }), {});
console.log(`MIGRATION_COMPLETE created=${created} existing=${refs.length - missing.length} collections=${JSON.stringify(counts)}`);
