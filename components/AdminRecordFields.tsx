"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CloudinaryImageField, type UploadedAsset } from "@/components/CloudinaryImageField";

type Locale = "ar" | "en";
type Localized = { title?: string; description?: string; summary?: string; body?: string; question?: string; answer?: string; sections?: Section[]; [key: string]: unknown };
type Section = { type?: "text" | "collection" | "record" | "form"; collection?: string; recordId?: string; formType?: string; heading?: string; body?: string; imageUrl?: string; imagePublicId?: string; imageAlt?: string; buttonLabel?: string; buttonUrl?: string };
type ManagedField = { name?: string; label?: string; type?: string; required?: boolean; options?: string[]; placeholder?: string; full?: boolean };
type BrandLink = { href?: string; sortOrder?: number; locales?: Record<Locale, { label?: string }> };
type RecordData = { id?: string; status?: string; locales?: Partial<Record<Locale, Localized>>; [key: string]: unknown };

function hasValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function inputText(value: unknown): string {
  if (hasValue(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

const labels = {
  ar: { id: "معرّف السجل", status: "حالة النشر", draft: "مسودة", published: "منشور", arabic: "العربية", english: "English", title: "العنوان", description: "الوصف المختصر", summary: "الملخص", body: "النص", question: "السؤال", answer: "الإجابة", sections: "مقاطع الصفحة", add: "إضافة مقطع", remove: "حذف", heading: "عنوان المقطع", image: "رابط الصورة", alt: "وصف الصورة", button: "نص الزر", url: "رابط الزر", path: "مسار الصفحة", logo: "الشعار الرئيسي", footerLogo: "شعار الفوتر", favicon: "الفافيكون", primary: "اللون الرئيسي", accent: "اللون المساند", fontAr: "خط العربية", fontEn: "خط الإنجليزية", contact: "بيانات التواصل", address: "العنوان", postal: "الرمز البريدي", email: "البريد الإلكتروني", phone: "رقم الهاتف", recruitment: "البريد الوظيفي", map: "رابط الخريطة", socials: "حسابات التواصل", instagram: "Instagram", facebook: "Facebook", x: "X", tiktok: "TikTok", duration: "المدة", category: "التصنيف", startDate: "تاريخ البداية", endDate: "تاريخ النهاية", location: "الموقع", price: "الرسوم", imageUrl: "رابط الصورة", eventDate: "تاريخ الفعالية", sectionType: "نوع المقطع", textSection: "نص", collectionSection: "قائمة محتوى", recordSection: "سجل واحد", formSection: "نموذج", collection: "مصدر البيانات", recordId: "معرّف السجل المرتبط", formType: "نوع النموذج", fields: "حقول النموذج", fieldName: "اسم الحقل التقني", fieldLabel: "عنوان الحقل", fieldType: "نوع الحقل", required: "إلزامي", options: "الخيارات مفصولة بفواصل", placeholder: "نص الإرشاد", addField: "إضافة حقل", statusNew: "جديد", reviewing: "قيد المراجعة", contacted: "تم التواصل", accepted: "مقبول", closed: "مغلق", internalNotes: "ملاحظات داخلية", format: "الصيغة", resourceType: "نوع الملف", originalName: "اسم الملف", sensitive: "بيانات المتقدم (للقراءة فقط)" },
  en: { id: "Record ID", status: "Publication status", draft: "Draft", published: "Published", arabic: "Arabic", english: "English", title: "Title", description: "Short description", summary: "Summary", body: "Text", question: "Question", answer: "Answer", sections: "Page sections", add: "Add section", remove: "Remove", heading: "Section heading", image: "Image URL", alt: "Image description", button: "Button label", url: "Button URL", path: "Page path", logo: "Main logo", footerLogo: "Footer logo", favicon: "Favicon", primary: "Primary color", accent: "Accent color", fontAr: "Arabic font", fontEn: "English font", contact: "Contact details", address: "Address", postal: "Postal code", email: "Email", phone: "Phone", recruitment: "Recruitment email", map: "Map URL", socials: "Social accounts", instagram: "Instagram", facebook: "Facebook", x: "X", tiktok: "TikTok", duration: "Duration", category: "Category", startDate: "Start date", endDate: "End date", location: "Location", price: "Tuition", imageUrl: "Image URL", eventDate: "Event date", sectionType: "Section type", textSection: "Text", collectionSection: "Content list", recordSection: "Single record", formSection: "Form", collection: "Data source", recordId: "Linked record ID", formType: "Form type", fields: "Form fields", fieldName: "Field key", fieldLabel: "Field label", fieldType: "Field type", required: "Required", options: "Options separated by commas", placeholder: "Placeholder", addField: "Add field", statusNew: "New", reviewing: "In review", contacted: "Contacted", accepted: "Accepted", closed: "Closed", internalNotes: "Internal notes", format: "Format", resourceType: "File type", originalName: "File name", sensitive: "Applicant details (read only)" },
} as const;

function TextInput({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: unknown; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  const current = inputText(value);
  if (!current) return null;
  return <label className="structured-field"><span>{label}</span><input type={type} value={current} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
function TextArea({ label, value, onChange, rows = 3, allowEmpty = false }: { label: string; value: unknown; onChange: (value: string) => void; rows?: number; allowEmpty?: boolean }) {
  const current = inputText(value);
  if (!current && !allowEmpty) return null;
  return <label className="structured-field"><span>{label}</span><textarea rows={rows} value={current} onChange={(event) => onChange(event.target.value)} /></label>;
}
function ListTextArea({ label, value, onChange, rows = 6 }: { label: string; value: unknown; onChange: (value: string[]) => void; rows?: number }) {
  const lines = Array.isArray(value) ? value.filter((item): item is string => hasValue(item)) : [];
  if (lines.length === 0) return null;
  return <label className="structured-field"><span>{label}</span><textarea rows={rows} value={lines.join("\n")} onChange={(event) => onChange(event.target.value.split("\n"))} /></label>;
}

export function AdminRecordFields({ collection, value, onChange, english, onMediaUploaded }: { collection: string; value: RecordData; onChange: (value: RecordData) => void; english: boolean; onMediaUploaded?: (asset: UploadedAsset, file: File) => Promise<void> }) {
  const [editingImages, setEditingImages] = useState<Record<string, boolean>>({});
  const [noteTarget, setNoteTarget] = useState("");
  const t = labels[english ? "en" : "ar"];
  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  const setLocale = (locale: Locale, key: string, next: unknown) => {
    const locales = value.locales || {};
    const current = locales[locale] || {};
    onChange({ ...value, locales: { ...locales, [locale]: { ...current, [key]: next } } });
  };
  const updateBrandText = (locale: Locale, group: "footer" | "nav" | "contact", key: string, next: string) => {
    const locales = (value.locales || {}) as Record<Locale, Record<string, unknown>>;
    const current = locales[locale] || {};
    const copy = current[group] && typeof current[group] === "object" ? current[group] as Record<string, unknown> : {};
    set("locales", { ...locales, [locale]: { ...current, [group]: { ...copy, [key]: next } } });
  };
  const updateBrandLink = (listName: "navigation" | "footerLinks", index: number, key: "href" | "ar" | "en", next: string) => {
    const list = Array.isArray(value[listName]) ? value[listName] as BrandLink[] : [];
    set(listName, list.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (key === "href") return { ...item, href: next };
      return { ...item, locales: { ...(item.locales || {}), [key]: { ...(item.locales?.[key] || {}), label: next } } };
    }));
  };
  const addBrandLink = (listName: "navigation" | "footerLinks") => {
    const list = Array.isArray(value[listName]) ? value[listName] as BrandLink[] : [];
    const number = list.length + 1;
    set(listName, [...list, { href: `/new-link-${number}`, sortOrder: list.length, locales: { ar: { label: `رابط جديد ${number}` }, en: { label: `New link ${number}` } } }]);
  };
  const removeBrandLink = (listName: "navigation" | "footerLinks", index: number) => {
    const list = Array.isArray(value[listName]) ? value[listName] as BrandLink[] : [];
    set(listName, list.filter((_, itemIndex) => itemIndex !== index).map((item, sortOrder) => ({ ...item, sortOrder })));
  };
  const renderBrandLinks = (listName: "navigation" | "footerLinks", title: string) => {
    const list = Array.isArray(value[listName]) ? value[listName] as BrandLink[] : [];
    return <><div className="structured-section-head"><strong>{title}</strong><button type="button" onClick={() => addBrandLink(listName)}><Plus size={14} />{english ? "Add link" : "إضافة رابط"}</button></div>{list.map((item, index) => <div className="structured-section" key={`${listName}-${index}`}><div className="structured-section-head"><strong>{String(item.href || "/")}</strong><button type="button" className="structured-remove" onClick={() => removeBrandLink(listName, index)}><Trash2 size={13} />{t.remove}</button></div><div className="structured-grid"><TextInput label={english ? "Route" : "المسار"} value={item.href} onChange={(next) => updateBrandLink(listName, index, "href", next)} /><TextInput label={english ? "Arabic label" : "التسمية بالعربية"} value={item.locales?.ar?.label} onChange={(next) => updateBrandLink(listName, index, "ar", next)} /><TextInput label={english ? "English label" : "التسمية بالإنجليزية"} value={item.locales?.en?.label} onChange={(next) => updateBrandLink(listName, index, "en", next)} /></div></div>)}</>;
  };
  const isPage = collection === "pages";
  const isBrand = collection === "brand";
  const isForm = collection === "forms";
  const hasImage = ["programs", "courses", "news", "gallery", "media"].includes(collection);
  const imageKey = collection === "media" ? "url" : "imageUrl";
  const publicIdKey = collection === "media" ? "publicId" : "imagePublicId";
  const imageLabel = collection === "media" ? (english ? "Media image" : "صورة الوسائط") : t.imageUrl;
  const renderMaybeTextInput = (label: string, current: unknown, onChange: (next: string) => void, type = "text") => hasValue(current) ? <TextInput label={label} value={current} onChange={onChange} type={type} /> : null;
  const renderMaybeTextArea = (label: string, current: unknown, onChange: (next: string) => void, rows = 3) => hasValue(current) ? <TextArea label={label} value={current} onChange={onChange} rows={rows} /> : null;
  const renderImageField = (key: string, label: string, imageValue: unknown, idValue: unknown, onAssetChange: (url: string, id?: string, resourceType?: string) => void, type = "image", afterUpload?: (asset: UploadedAsset, file: File) => Promise<void>) => {
    if (!hasValue(imageValue) && !editingImages[key]) return <button key={key} type="button" className="admin-secondary-button" onClick={() => setEditingImages((current) => ({ ...current, [key]: true }))}><Plus size={14} />{english ? `Add ${label.toLowerCase()}` : `إضافة ${label}`}</button>;
    return <CloudinaryImageField key={key} label={label} value={imageValue} publicId={idValue} resourceType={type} english={english} onChange={onAssetChange} onUploaded={afterUpload} />;
  };
  const imageField = hasImage ? renderImageField(imageKey, imageLabel, value[imageKey], value[publicIdKey], (url, id, resourceType) => onChange({ ...value, [imageKey]: url, [publicIdKey]: id || "", ...(collection === "media" ? { resourceType: resourceType || "image" } : {}) }), String(value.resourceType || "image"), collection === "media" ? undefined : onMediaUploaded) : null;

  if (collection === "audit_logs") return <div className="structured-record"><div className="submission-fields">{(["action", "collection", "recordId", "actorUid", "at"] as const).map((key) => <div key={key}><dt>{key}</dt><dd>{String(value[key] ?? "")}</dd></div>)}</div></div>;

  if (["applications", "employer_inquiries", "contact_inquiries"].includes(collection)) {
    const fields = typeof value.fields === "object" && value.fields !== null ? value.fields as Record<string, unknown> : {};
    const target = String(value.id || "");
    const noteExists = hasValue(value.internalNotes);
    return <div className="structured-record"><div className="structured-grid"><label className="structured-field"><span>{t.status}</span><select value={String(value.status || "new")} onChange={(event) => set("status", event.target.value)}><option value="new">{t.statusNew}</option><option value="in_review">{t.reviewing}</option><option value="contacted">{t.contacted}</option><option value="accepted">{t.accepted}</option><option value="closed">{t.closed}</option></select></label>{noteExists || noteTarget === target ? <TextArea label={t.internalNotes} value={value.internalNotes} onChange={(next) => set("internalNotes", next)} allowEmpty={noteTarget === target && !noteExists} /> : <button type="button" className="admin-secondary-button" onClick={() => setNoteTarget(target)}><Plus size={14} />{english ? "Add internal note" : "إضافة ملاحظة داخلية"}</button>}</div><h3>{t.sensitive}</h3><dl className="submission-fields">{Object.entries(fields).map(([key, field]) => <div key={key}><dt>{key}</dt><dd>{String(field)}</dd></div>)}</dl></div>;
  }

  const recordHeader = (withPath = false) => <div className="structured-grid"><TextInput label={t.id} value={value.id} onChange={(next) => set("id", next)} /><label className="structured-field"><span>{t.status}</span><select value={String(value.status || "draft")} onChange={(event) => set("status", event.target.value)}><option value="draft">{t.draft}</option><option value="published">{t.published}</option></select></label>{withPath && <TextInput label={t.path} value={value.path} onChange={(next) => set("path", next)} />}</div>;
  const localeTextInput = (locale: Locale, key: string, label: string) => {
    const localized = value.locales?.[locale] || {};
    return renderMaybeTextInput(label, localized[key], (next) => setLocale(locale, key, next));
  };
  const setLocaleList = (locale: Locale, key: string, next: string[]) => setLocale(locale, key, next.map((item) => item.trim()).filter(Boolean));
  const renderPageSections = (locale: Locale, sections: Section[]) => {
    const activeSections = sections.map((section, index) => ({ section, index })).filter(({ section }) => section.type || [section.body, section.imageUrl, section.buttonLabel, section.buttonUrl, section.collection, section.formType].some(hasValue));
    const templateSections = sections.filter((section) => !section.type && ![section.body, section.imageUrl, section.buttonLabel, section.buttonUrl, section.collection, section.formType].some(hasValue));
    return <div className="structured-sections"><div className="structured-section-head"><strong>{t.sections}</strong><button type="button" onClick={() => setLocale(locale, "sections", [...sections, { type: "text", heading: english ? "New section" : "مقطع جديد", body: english ? "Add section copy here." : "أضف نص المقطع هنا." }])}><Plus size={14} />{t.add}</button></div>{templateSections.length > 0 && <p className="structured-field-help">{english ? `Page template sections: ${templateSections.map((section) => section.heading).filter(hasValue).join(", ")}` : `أقسام قالب الصفحة: ${templateSections.map((section) => section.heading).filter(hasValue).join("، ")}`}</p>}{activeSections.map(({ section, index }) => <div className="structured-section" key={index}><div className="structured-section-head"><strong>{hasValue(section.heading) ? section.heading : `${t.sections} ${index + 1}`}</strong><button type="button" className="structured-remove" onClick={() => setLocale(locale, "sections", sections.filter((_, sectionIndex) => sectionIndex !== index))}><Trash2 size={13} />{t.remove}</button></div><div className="structured-grid"><label className="structured-field"><span>{t.sectionType}</span><select value={section.type || "text"} onChange={(event) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, type: event.target.value as Section["type"] } : item))}><option value="text">{t.textSection}</option><option value="collection">{t.collectionSection}</option><option value="record">{t.recordSection}</option><option value="form">{t.formSection}</option></select></label>{(section.type === "collection" || section.type === "record") && <label className="structured-field"><span>{t.collection}</span><select value={section.collection || "programs"} onChange={(event) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, collection: event.target.value } : item))}>{["programs", "courses", "gallery", "faqs", "partners", "policies", "support", "resources", "calendar", "admissions", "news"].map((name) => <option key={name} value={name}>{name}</option>)}</select></label>}{section.type === "record" && renderMaybeTextInput(t.recordId, section.recordId, (next) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, recordId: next } : item)))}{section.type === "form" && <label className="structured-field"><span>{t.formType}</span><select value={section.formType || "application_interest"} onChange={(event) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, formType: event.target.value } : item))}>{["quick_interest", "application_interest", "employer_inquiry", "future_diploma_interest", "contact_inquiry"].map((name) => <option key={name} value={name}>{name}</option>)}</select></label>}{renderMaybeTextInput(t.heading, section.heading, (next) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, heading: next } : item)))}{section.type !== "collection" && section.type !== "record" && section.type !== "form" && <>{renderImageField(`section-${locale}-${index}`, t.image, section.imageUrl, section.imagePublicId, (url, id) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, imageUrl: url, imagePublicId: id || "" } : item)), "image", onMediaUploaded)}{renderMaybeTextArea(t.body, section.body, (next) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, body: next } : item)), 5)}{renderMaybeTextInput(t.alt, section.imageAlt, (next) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, imageAlt: next } : item)))}{renderMaybeTextInput(t.button, section.buttonLabel, (next) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, buttonLabel: next } : item)))}{renderMaybeTextInput(t.url, section.buttonUrl, (next) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, buttonUrl: next } : item)))}</>}</div></div>)}</div>;
  };

  if (collection === "admissions") return <div className="structured-record">{recordHeader()}<h3>{english ? "Admission criteria and documents" : "شروط القبول والوثائق"}</h3>{(["ar", "en"] as Locale[]).map((locale) => {
    const localized = value.locales?.[locale] || {};
    return <section className="structured-locale" key={locale} dir={locale === "ar" ? "rtl" : "ltr"}><h4>{locale === "ar" ? t.arabic : t.english}</h4><div className="structured-grid"><ListTextArea label={english ? "Admission requirements" : "شروط القبول"} value={localized.requirements} onChange={(next) => setLocaleList(locale, "requirements", next)} rows={8} /><ListTextArea label={english ? "Required documents" : "الوثائق المطلوبة"} value={localized.documents} onChange={(next) => setLocaleList(locale, "documents", next)} rows={4} /></div></section>;
  })}</div>;

  if (collection === "media") return <div className="structured-record">{recordHeader()}<div className="structured-grid">{imageField}{(["format", "resourceType", "originalName"] as const).map((key) => renderMaybeTextInput(t[key], value[key], (next) => set(key, next)))}</div><h3>{english ? "Image descriptions" : "وصف الصورة"}</h3><div className="structured-grid">{(["ar", "en"] as Locale[]).map((locale) => renderMaybeTextInput(`${t.alt} · ${locale === "ar" ? t.arabic : t.english}`, (value.alt as Record<string, unknown> | undefined)?.[locale], (next) => set("alt", { ...(value.alt as object || {}), [locale]: next })))}</div></div>;

  if (collection === "media") return <div className="structured-record">{recordHeader()}<div className="structured-grid">{imageField}{(["format", "resourceType", "originalName"] as const).map((key) => renderMaybeTextInput(t[key], value[key], (next) => set(key, next)))}</div><h3>{english ? "Image descriptions" : "وصف الصورة"}</h3><div className="structured-grid">{(["ar", "en"] as Locale[]).map((locale) => renderMaybeTextInput(`${t.alt} · ${locale === "ar" ? t.arabic : t.english}`, (value.alt as Record<string, unknown> | undefined)?.[locale], (next) => set("alt", { ...(value.alt as object || {}), [locale]: next })))}</div></div>;

  if (collection === "calendar") return <div className="structured-record">{recordHeader()}<h3>{english ? "Calendar document" : "وثيقة التقويم"}</h3><div className="structured-grid">{(["ar", "en"] as Locale[]).map((locale) => localeTextInput(locale, "title", `${t.title} · ${locale === "ar" ? t.arabic : t.english}`))}{renderMaybeTextInput(english ? "Calendar document URL" : "رابط وثيقة التقويم", value.url, (next) => set("url", next))}{renderMaybeTextInput(t.eventDate, value.eventDate, (next) => set("eventDate", next))}</div></div>;

  if (collection === "gallery") return <div className="structured-record">{recordHeader()}<div className="structured-grid">{imageField}</div>{(["ar", "en"] as Locale[]).map((locale) => {
    const localized = value.locales?.[locale] || {};
    return <section className="structured-locale" key={locale} dir={locale === "ar" ? "rtl" : "ltr"}><h4>{locale === "ar" ? t.arabic : t.english}</h4><div className="structured-grid">{localeTextInput(locale, "title", t.title)}{localeTextInput(locale, "caption", english ? "Caption" : "التعليق" )}{localeTextInput(locale, "alt", t.alt)}</div></section>;
  })}</div>;

  if (collection === "resources") return <div className="structured-record">{recordHeader()}<h3>{english ? "Document details" : "بيانات الوثيقة"}</h3><div className="structured-grid">{renderMaybeTextInput(english ? "Document URL" : "رابط الوثيقة", value.url, (next) => set("url", next))}{renderMaybeTextInput(t.format, value.format, (next) => set("format", next))}{(["ar", "en"] as Locale[]).flatMap((locale) => { const localized = value.locales?.[locale] || {}; return [localeTextInput(locale, "title", `${t.title} · ${locale === "ar" ? t.arabic : t.english}`), localeTextInput(locale, "category", `${t.category} · ${locale === "ar" ? t.arabic : t.english}`)]; })}</div></div>;

  if (collection === "partners") return <div className="structured-record">{recordHeader()}<div className="structured-grid">{renderImageField("logoUrl", english ? "Partner logo" : "شعار الشريك", value.logoUrl, value.logoPublicId, (url, id) => onChange({ ...value, logoUrl: url, logoPublicId: id || "" }), "image", onMediaUploaded)}{renderMaybeTextInput(english ? "Partner website" : "الموقع الإلكتروني", value.website, (next) => set("website", next))}{renderMaybeTextInput(english ? "Image usage rights" : "حقوق استخدام الشعار", value.usageRights, (next) => set("usageRights", next))}</div>{(["ar", "en"] as Locale[]).map((locale) => {
    const localized = value.locales?.[locale] || {};
    return <section className="structured-locale" key={locale} dir={locale === "ar" ? "rtl" : "ltr"}><h4>{locale === "ar" ? t.arabic : t.english}</h4><div className="structured-grid">{localeTextInput(locale, "title", t.title)}{localeTextInput(locale, "group", t.category)}{localeTextInput(locale, "role", english ? "Partner role" : "دور الشريك")}</div></section>;
  })}</div>;

  if (["programs", "courses"].includes(collection)) return <div className="structured-record">{recordHeader()}<div className="structured-grid">{imageField}</div>{(["ar", "en"] as Locale[]).map((locale) => {
    const localized = value.locales?.[locale] || {};
    const listFields = ["pillars", "documents"] as const;
    return <section className="structured-locale" key={locale} dir={locale === "ar" ? "rtl" : "ltr"}><h4>{locale === "ar" ? t.arabic : t.english}</h4><div className="structured-grid">{localeTextInput(locale, "title", t.title)}{renderMaybeTextArea(t.description, localized.description, (next) => setLocale(locale, "description", next), 4)}{localeTextInput(locale, "category", t.category)}{localeTextInput(locale, "status", english ? "Availability" : "حالة البرنامج")}{localeTextInput(locale, "duration", t.duration)}{localeTextInput(locale, "hoursAndSchedule", english ? "Hours and schedule" : "الساعات والجدول")}{localeTextInput(locale, "targetAudience", english ? "Target audience" : "الفئة المستهدفة")}{localeTextInput(locale, "outcomes", english ? "Learning outcomes" : "مخرجات التعلم")}{localeTextInput(locale, "careers", english ? "Career opportunities" : "الفرص الوظيفية")}{localeTextInput(locale, "requirements", english ? "Requirements" : "المتطلبات")}{listFields.map((key) => Array.isArray(localized[key]) && (localized[key] as unknown[]).length > 0 ? <ListTextArea key={key} label={key === "pillars" ? english ? "Training pillars" : "محاور التدريب" : english ? "Required documents" : "الوثائق المطلوبة"} value={localized[key]} onChange={(next) => setLocaleList(locale, key, next)} rows={4} /> : null)}</div></section>;
  })}</div>;

  if (collection === "faqs") return <div className="structured-record">{recordHeader()}{(["ar", "en"] as Locale[]).map((locale) => {
    const localized = value.locales?.[locale] || {};
    return <section className="structured-locale" key={locale} dir={locale === "ar" ? "rtl" : "ltr"}><h4>{locale === "ar" ? t.arabic : t.english}</h4><div className="structured-grid">{localeTextInput(locale, "question", t.question)}{renderMaybeTextArea(t.answer, localized.answer, (next) => setLocale(locale, "answer", next), 4)}</div></section>;
  })}</div>;

  if (["policies", "support"].includes(collection)) return <div className="structured-record">{recordHeader()}<div className="structured-grid">{renderMaybeTextInput(english ? "Source page" : "الصفحة المصدر", value.source, (next) => set("source", next))}{hasValue((value.document as Record<string, unknown> | undefined)?.href) && <TextInput label={english ? "Document URL" : "رابط الوثيقة"} value={(value.document as Record<string, unknown>).href} onChange={(next) => set("document", { ...(value.document as object), href: next })} />}{hasValue((value.document as Record<string, unknown> | undefined)?.title) && <TextInput label={english ? "Document title" : "عنوان الوثيقة"} value={(value.document as Record<string, unknown>).title} onChange={(next) => set("document", { ...(value.document as object), title: next })} />}</div>{(["ar", "en"] as Locale[]).map((locale) => {
    const localized = value.locales?.[locale] || {};
    const sections = Array.isArray(localized.sections) ? localized.sections : [];
    return <section className="structured-locale" key={locale} dir={locale === "ar" ? "rtl" : "ltr"}><h4>{locale === "ar" ? t.arabic : t.english}</h4><div className="structured-grid">{localeTextInput(locale, "title", t.title)}{renderMaybeTextArea(t.summary, localized.summary, (next) => setLocale(locale, "summary", next), 4)}</div>{sections.length > 0 && <div className="structured-sections"><strong>{english ? "Section headings" : "عناوين الأقسام"}</strong>{sections.map((section, index) => <div className="structured-section" key={`${locale}-${index}`}><div className="structured-grid">{hasValue(section.heading) && <TextInput label={`${t.heading} ${index + 1}`} value={section.heading} onChange={(next) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, heading: next } : item))} />}{renderMaybeTextArea(t.body, section.body, (next) => setLocale(locale, "sections", sections.map((item, i) => i === index ? { ...item, body: next } : item)), 4)}</div></div>)}</div>}</section>;
  })}</div>;

  return <div className="structured-record">
    {recordHeader(isPage)}

    {isBrand ? <>
      <h3>{english ? "Brand assets and theme" : "أصول الهوية والمظهر"}</h3>
      <div className="structured-grid">{renderImageField("logoUrl", t.logo, value.logoUrl, value.logoPublicId, (url, id) => onChange({ ...value, logoUrl: url, logoPublicId: id || "" }), "image", onMediaUploaded)}{renderImageField("footerLogoUrl", t.footerLogo, value.footerLogoUrl, value.footerLogoPublicId, (url, id) => onChange({ ...value, footerLogoUrl: url, footerLogoPublicId: id || "" }), "image", onMediaUploaded)}{renderImageField("faviconUrl", t.favicon, value.faviconUrl, value.faviconPublicId, (url, id) => onChange({ ...value, faviconUrl: url, faviconPublicId: id || "" }), "image", onMediaUploaded)}<TextInput label={t.primary} type="color" value={value.primaryColor || "#087180"} onChange={(next) => set("primaryColor", next)} /><TextInput label={t.accent} type="color" value={value.accentColor || "#f1a52d"} onChange={(next) => set("accentColor", next)} /><label className="structured-field"><span>{t.fontAr}</span><select value={String(value.fontArabic || "IBM Plex Sans Arabic")} onChange={(event) => set("fontArabic", event.target.value)}><option>IBM Plex Sans Arabic</option><option>Arial</option><option>Georgia</option><option>system-ui</option></select></label><label className="structured-field"><span>{t.fontEn}</span><select value={String(value.fontEnglish || "Montserrat")} onChange={(event) => set("fontEnglish", event.target.value)}><option>Montserrat</option><option>Arial</option><option>Georgia</option><option>system-ui</option></select></label></div>
      <h3>{t.contact}</h3><div className="structured-grid">{(["address", "postal", "email", "phone", "recruitment", "map"] as const).map((key) => renderMaybeTextInput(t[key], (value.contact as Record<string, unknown> | undefined)?.[key], (next) => set("contact", { ...(value.contact as object || {}), [key]: next }), key === "email" || key === "recruitment" ? "email" : "text"))}</div>
      <h3>{t.socials}</h3><div className="structured-grid">{(["instagram", "facebook", "x", "tiktok"] as const).map((key) => { const current = (value.socialLinks as Record<string, unknown> | undefined)?.[key]; return renderMaybeTextInput(t[key], current, (next) => set("socialLinks", { ...(value.socialLinks as object || {}), [key]: next })); })}</div>
      <h3>{english ? "Header and footer copy" : "نصوص الهيدر والفوتر"}</h3>
      {(["ar", "en"] as Locale[]).map((locale) => {
        const copy = (value.locales as Record<Locale, Record<string, unknown>> | undefined)?.[locale] || {};
        const footer = copy.footer && typeof copy.footer === "object" ? copy.footer as Record<string, unknown> : {};
        const nav = copy.nav && typeof copy.nav === "object" ? copy.nav as Record<string, unknown> : {};
        const localizedContact = copy.contact && typeof copy.contact === "object" ? copy.contact as Record<string, unknown> : {};
        const footerFields = [["mission", english ? "Footer mission" : "نبذة الفوتر"], ["quickLinks", english ? "Quick links heading" : "عنوان الروابط السريعة"], ["programs", english ? "Programs heading" : "عنوان البرامج"], ["allPrograms", english ? "All programs link" : "رابط جميع البرامج"], ["contactUs", english ? "Contact heading" : "عنوان التواصل"], ["allContact", english ? "All contact link" : "رابط معلومات التواصل"], ["copyright", english ? "Copyright name" : "اسم حقوق النشر"], ["demo", english ? "Footer notice" : "ملاحظة الفوتر"], ["socialLabel", english ? "Social links label" : "وصف روابط التواصل"]] as const;
        return <section className="structured-locale" key={locale} dir={locale === "ar" ? "rtl" : "ltr"}><h4>{locale === "ar" ? t.arabic : t.english}</h4><div className="structured-grid">{footerFields.map(([key, label]) => renderMaybeTextInput(label, footer[key], (next) => updateBrandText(locale, "footer", key, next)))}{renderMaybeTextInput(english ? "Apply button label" : "تسمية زر التسجيل", nav.apply, (next) => updateBrandText(locale, "nav", "apply", next))}{renderMaybeTextInput(english ? "Navigation accessibility label" : "وصف قائمة التنقل", nav.mainLabel, (next) => updateBrandText(locale, "nav", "mainLabel", next))}</div><h5>{english ? "Contact details for this language" : "بيانات التواصل بهذه اللغة"}</h5><div className="structured-grid">{(["address", "postal", "email", "phone", "recruitment", "map"] as const).map((key) => renderMaybeTextInput(t[key], localizedContact[key], (next) => updateBrandText(locale, "contact", key, next), key === "email" || key === "recruitment" ? "email" : "text"))}</div></section>;
      })}
      <div className="structured-sections">{renderBrandLinks("navigation", english ? "Header navigation" : "روابط الهيدر")}{renderBrandLinks("footerLinks", english ? "Footer quick links" : "روابط الفوتر السريعة")}</div>
    </> : <>
      {isPage && <h3>{english ? "Page content" : "محتوى الصفحة"}</h3>}
      {imageField && <div className="structured-grid">{imageField}</div>}
      {(["ar", "en"] as Locale[]).map((locale) => {
        const localized = value.locales?.[locale] || {};
        const sections = Array.isArray(localized.sections) ? localized.sections : [];
        return <section className="structured-locale" key={locale} dir={locale === "ar" ? "rtl" : "ltr"}><h3>{locale === "ar" ? t.arabic : t.english}</h3>
          <div className="structured-grid">{renderMaybeTextInput(t.title, localized.title, (next) => setLocale(locale, "title", next))}{renderMaybeTextArea(t.description, localized.description, (next) => setLocale(locale, "description", next), 4)}</div>
          {collection === "news" && renderMaybeTextArea(t.body, localized.body, (next) => setLocale(locale, "body", next), 5)}
          {isPage && renderPageSections(locale, sections)}
          {isForm && <><TextInput label={t.button} value={inputText(localized.buttonLabel) || (english ? "Submit" : "إرسال")} onChange={(next) => setLocale(locale, "buttonLabel", next)} /><div className="structured-sections"><div className="structured-section-head"><strong>{t.fields}</strong><button type="button" onClick={() => { const fields = Array.isArray(localized.fields) ? localized.fields as ManagedField[] : []; const count = fields.length + 1; setLocale(locale, "fields", [...fields, { name: `new_field_${count}`, label: english ? `New field ${count}` : `حقل جديد ${count}`, type: "text", required: false }]); }}><Plus size={14} />{t.addField}</button></div>{(Array.isArray(localized.fields) ? localized.fields as ManagedField[] : []).map((field, index, fields) => <div className="structured-section" key={`${field.name || "field"}-${index}`}><div className="structured-section-head"><strong>{field.label || `${t.fields} ${index + 1}`}</strong><button type="button" className="structured-remove" onClick={() => setLocale(locale, "fields", fields.filter((_, fieldIndex) => fieldIndex !== index))}><Trash2 size={13} />{t.remove}</button></div><div className="structured-grid"><TextInput label={t.fieldName} value={inputText(field.name) || `new_field_${index + 1}`} onChange={(next) => setLocale(locale, "fields", fields.map((item, i) => i === index ? { ...item, name: next.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40) } : item))} /><TextInput label={t.fieldLabel} value={inputText(field.label) || (english ? `New field ${index + 1}` : `حقل جديد ${index + 1}`)} onChange={(next) => setLocale(locale, "fields", fields.map((item, i) => i === index ? { ...item, label: next } : item))} /><label className="structured-field"><span>{t.fieldType}</span><select value={field.type || "text"} onChange={(event) => setLocale(locale, "fields", fields.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}>{["text", "email", "tel", "select", "textarea"].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>{renderMaybeTextInput(t.placeholder, field.placeholder, (next) => setLocale(locale, "fields", fields.map((item, i) => i === index ? { ...item, placeholder: next } : item)))}{field.type === "select" && Array.isArray(field.options) && field.options.length > 0 && <TextInput label={t.options} value={field.options.join(", ")} onChange={(next) => setLocale(locale, "fields", fields.map((item, i) => i === index ? { ...item, options: next.split(",").map((option) => option.trim()).filter(Boolean).slice(0, 30) } : item))} />}{field.type === "select" && (!Array.isArray(field.options) || field.options.length === 0) && <span className="structured-field-help">{english ? "Choices are generated from published programs." : "تُعرض الخيارات تلقائيًا من البرامج المنشورة."}</span>}<label className="structured-field"><span>{t.required}</span><input type="checkbox" checked={field.required === true} onChange={(event) => setLocale(locale, "fields", fields.map((item, i) => i === index ? { ...item, required: event.target.checked } : item))} /></label></div></div>)}</div></>}
        </section>;
      })}
    </>}
  </div>;
}
