"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CloudinaryImageField, type UploadedAsset } from "./CloudinaryImageField";
import { BilingualField } from "./ContentAssistant";
import { contentResources, fieldsFor, getPath, setPath, type ContentRecord } from "@/lib/admin/content";
type Props = { collection: string; value: ContentRecord; english: boolean; onChange: (value: ContentRecord) => void; request: (url: string, init?: RequestInit) => Promise<{ items?: ContentRecord[] }>; onMediaUploaded: (asset: UploadedAsset, file: File) => Promise<void>; errors?: Array<{ path: Array<string | number>; message: string }> };
const FieldErrors = createContext<Props["errors"]>([]);
const asText = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
function Input({ label, value, onChange, type = "text", multiline = false, name, readOnly = false }: { label: string; value: unknown; onChange: (text: string) => void; type?: string; multiline?: boolean; name?: string; readOnly?: boolean }) {
  const errors = useContext(FieldErrors)?.filter(v => v.path.join(".") === name) || [];
  return <label className="structured-field"><span>{label}</span>{multiline ? <textarea name={name} readOnly={readOnly} aria-invalid={errors.length ? true : undefined} value={asText(value)} rows={4} onChange={e => onChange(e.target.value)} /> : <input name={name} readOnly={readOnly} aria-invalid={errors.length ? true : undefined} type={type} value={asText(value)} onChange={e => onChange(e.target.value)} />}{errors.map((v, i) => <small className="field-error" key={i}>{v.message}</small>)}</label>;
}
function RecordPicker({ collection, value, onChange, request, english: en }: { collection: string; value: unknown; onChange: (id: string) => void; request: Props["request"]; english: boolean }) {
  const [items, setItems] = useState<ContentRecord[]>([]), [error, setError] = useState(false);
  useEffect(() => { let active = true; setItems([]); setError(false); request("/api/admin/data?collection=" + encodeURIComponent(collection)).then(r => { if (active) setItems(r.items || []); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [collection, request]);
  return <label className="structured-field"><span>{en ? "Linked content" : "المحتوى المرتبط"}</span><select value={asText(value)} onChange={e => onChange(e.target.value)}><option value="">{en ? "Choose content" : "اختر المحتوى"}</option>{items.map(item => <option value={item.id} key={item.id}>{asText(getPath(item, "locales." + (en ? "en" : "ar") + ".title") || getPath(item, "locales.ar.question") || getPath(item, "locales.ar.title")) || (en ? "Untitled content" : "محتوى بلا عنوان")}</option>)}</select>{error && <small role="alert">{en ? "Could not load linked content. Reopen this section to retry." : "تعذر تحميل المحتوى المرتبط. أعد فتح المقطع للمحاولة."}</small>}</label>;
}
export function ContentFields(props: Props) { return <FieldErrors.Provider value={props.errors || []}><ContentFieldsBody {...props} /></FieldErrors.Provider>; }
function ContentFieldsBody({ collection, value, english: en, onChange, request, onMediaUploaded, errors = [] }: Props) {
  const put = (path: string, next: unknown) => onChange(setPath(value, path, next));
  const text = (key: string, label: string, type = "text") => <Input key={key} name={key} label={label} value={getPath(value, key)} onChange={v => put(key, v)} type={type} />;
  const bilingual = (key: string, label: string, multiline = false, list = false, required = false) => <BilingualField key={key} fieldKey={key} label={label} multiline={multiline} list={list} required={required} errors={errors} />;
  const image = (key: string, label: string) => <CloudinaryImageField key={key} label={label} value={value[key]} publicId={value[key === "url" ? "publicId" : key.replace(/Url$/, "PublicId")]} english={en} onUploaded={onMediaUploaded} onChange={(url, id) => onChange({ ...value, [key]: url, [key === "url" ? "publicId" : key.replace(/Url$/, "PublicId")]: id || "" })} />;
  const standard = fieldsFor(collection);
  const localizedField = (field: ReturnType<typeof fieldsFor>[number]) => bilingual(field.key, en ? field.en : field.ar, field.kind === "long", field.kind === "list", !field.optional);
  const sectionList = (locale: string) => { const raw = getPath(value, "locales." + locale + ".sections"); return Array.isArray(raw) ? raw as Array<Record<string, unknown>> : []; };
  const arSections = sectionList("ar"), enSections = sectionList("en");
  function syncSection(index: number, key: string, next: unknown) {
    let result = value;
    for (const locale of ["ar", "en"]) {
      const base = "locales." + locale + ".sections." + index;
      if (!getPath(result, base)) result = setPath(result, base, { ...(arSections[index] || enSections[index]), heading: "", body: "" });
      result = setPath(result, base + "." + key, next);
    }
    onChange(result);
  }
  const sectionEditor = <div className="content-sections"><div className="structured-section-head"><h3>{en ? "Page sections" : "مقاطع الصفحة"}</h3><button type="button" className="admin-secondary-button" onClick={() => {
    let next = value; const count = Math.max(arSections.length, enSections.length);
    for (const locale of ["ar", "en"]) { const sections = [...sectionList(locale)]; while (sections.length < count) sections.push({ type: "text", heading: "", body: "" }); next = setPath(next, "locales." + locale + ".sections", [...sections, { type: "text", heading: "", body: "" }]); }
    onChange(next);
  }}><Plus size={15} />{en ? "Add section" : "إضافة مقطع"}</button></div>{Array.from({ length: Math.max(arSections.length, enSections.length) }, (_, index) => {
    const section = arSections[index] || enSections[index], key = "sections." + index + ".";
    const hasImageDetails = Boolean(section.imageUrl || section.imageAlt || section.buttonLabel || section.buttonUrl);
    return <details className="content-panel" key={index} open><summary>{asText((en ? enSections[index] : arSections[index])?.heading) || (en ? "Section " : "المقطع ") + (index + 1)}</summary>
      {bilingual(key + "heading", en ? "Heading" : "عنوان المقطع")}
      {collection === "pages" && <label className="structured-field"><span>{en ? "Content type" : "نوع المحتوى"}</span><select value={asText(section.type) || "text"} onChange={e => syncSection(index, "type", e.target.value)}>{[["text", "نص وصورة", "Text & image"], ["collection", "قائمة محتوى", "Content list"], ["record", "عنصر مرتبط", "Linked item"], ["form", "نموذج", "Form"]].map(([id, ar, english]) => <option key={id} value={id}>{en ? english : ar}</option>)}</select></label>}
      {(!section.type || section.type === "text" || collection !== "pages") && bilingual(key + "body", en ? "Text" : "النص", true)}
      {["collection", "record"].includes(asText(section.type)) && <label className="structured-field"><span>{en ? "Content" : "المحتوى"}</span><select value={asText(section.collection)} onChange={e => {
        let next = value;
        for (const locale of ["ar", "en"]) { next = setPath(next, "locales." + locale + ".sections." + index + ".collection", e.target.value); next = setPath(next, "locales." + locale + ".sections." + index + ".recordId", ""); }
        onChange(next);
      }}><option value="">{en ? "Choose content" : "اختر المحتوى"}</option>{contentResources.filter(([id, , , area]) => ["training", "website", "media"].includes(area) && !["pages", "forms", "cohorts", "bookings", "payments", "media"].includes(id)).map(([id, ar, english]) => <option key={id} value={id}>{en ? english : ar}</option>)}</select></label>}
      {section.type === "record" && Boolean(section.collection) && <RecordPicker collection={asText(section.collection)} value={section.recordId} onChange={v => syncSection(index, "recordId", v)} request={request} english={en} />}
      {section.type === "form" && <label className="structured-field"><span>{en ? "Form" : "النموذج"}</span><select value={asText(section.formType)} onChange={e => syncSection(index, "formType", e.target.value)}><option value="">{en ? "Choose form" : "اختر النموذج"}</option>{[["quick_interest", "اهتمام مختصر", "Quick interest"], ["application_interest", "طلب اهتمام", "Application interest"], ["employer_inquiry", "استفسار منشأة", "Employer inquiry"], ["future_diploma_interest", "اهتمام بدبلوم", "Future diploma"], ["contact_inquiry", "تواصل", "Contact"]].map(([id, ar, english]) => <option key={id} value={id}>{en ? english : ar}</option>)}</select></label>}
      {(!section.type || section.type === "text") && <details className="content-panel" open={hasImageDetails}><summary>{en ? "Image and link" : "صورة ورابط"}</summary><CloudinaryImageField label={en ? "Section image" : "صورة المقطع"} value={section.imageUrl} publicId={section.imagePublicId} english={en} onUploaded={onMediaUploaded} onChange={(url, id) => {
        let next = value; for (const locale of ["ar", "en"]) { const path = "locales." + locale + ".sections." + index; next = setPath(setPath(next, path + ".imageUrl", url), path + ".imagePublicId", id || ""); } onChange(next);
      }} />{bilingual(key + "imageAlt", en ? "Image description" : "وصف الصورة")}{bilingual(key + "buttonLabel", en ? "Button label" : "نص الزر")}<Input label={en ? "Button destination" : "وجهة الزر"} value={section.buttonUrl} onChange={v => syncSection(index, "buttonUrl", v)} /></details>}
      <button type="button" className="admin-secondary-button danger" onClick={() => { let next = value; for (const locale of ["ar", "en"]) next = setPath(next, "locales." + locale + ".sections", sectionList(locale).filter((_, i) => i !== index)); onChange(next); }}><Trash2 size={14} />{en ? "Remove section" : "إزالة المقطع"}</button>
    </details>;
  })}</div>;
  if (collection === "brand") return <div className="structured-record">
    <div className="structured-grid">{image("logoUrl", en ? "Main logo" : "الشعار الرئيسي")}{text("primaryColor", en ? "Primary color" : "اللون الرئيسي", "color")}{text("accentColor", en ? "Accent color" : "اللون المساند", "color")}</div>
    <h3>{en ? "Contact details" : "بيانات التواصل"}</h3><div className="structured-grid">{[["email", "البريد الإلكتروني", "Email"], ["phone", "الهاتف", "Phone"], ["map", "الخريطة", "Map URL"]].map(([key, ar, english]) => text("contact." + key, en ? english : ar))}</div>
    {bilingual("contact.address", en ? "Address" : "العنوان")}
    <details className="content-panel" open><summary>{en ? "Footer and navigation wording" : "نصوص الفوتر والتنقل"}</summary>{["mission", "quickLinks", "programs", "allPrograms", "contactUs", "allContact", "copyright", "demo", "socialLabel"].map(key => bilingual("footer." + key, ({ mission: en ? "Footer description" : "نبذة الفوتر", quickLinks: en ? "Quick links heading" : "عنوان الروابط", programs: en ? "Programs heading" : "عنوان البرامج", allPrograms: en ? "All programs label" : "تسمية جميع البرامج", contactUs: en ? "Contact heading" : "عنوان التواصل", allContact: en ? "Contact link label" : "تسمية رابط التواصل", copyright: en ? "Copyright name" : "اسم حقوق النشر", demo: en ? "Footer notice" : "ملاحظة الفوتر", socialLabel: en ? "Social links description" : "وصف روابط التواصل" })[key]!))}{bilingual("nav.apply", en ? "Header button label" : "نص زر الهيدر")}{bilingual("nav.mainLabel", en ? "Menu accessibility label" : "وصف قائمة التنقل")}</details>
    {(["navigation", "footerLinks"] as const).map(list => { const links = Array.isArray(value[list]) ? value[list] as Array<Record<string, unknown>> : []; return <details className="content-panel" key={list} open={links.length > 0}><summary>{list === "navigation" ? en ? "Main navigation" : "قائمة التنقل" : en ? "Footer links" : "روابط الفوتر"}</summary>{links.map((link, i) => <div className="content-panel" key={i}>{text(list + "." + i + ".href", en ? "Destination" : "الوجهة")}{bilingual(list + "." + i + ".label", en ? "Label" : "التسمية")}<button type="button" className="admin-secondary-button danger" onClick={() => put(list, links.filter((_, index) => index !== i).map((v, sortOrder) => ({ ...v, sortOrder })))}>{en ? "Remove" : "إزالة"}</button></div>)}<button type="button" className="admin-secondary-button" onClick={() => put(list, [...links, { href: "/", sortOrder: links.length, locales: { ar: { label: "" }, en: { label: "" } } }])}>{en ? "Add link" : "إضافة رابط"}</button></details>; })}
    <details className="content-panel"><summary>{en ? "Additional brand settings" : "إعدادات الهوية الإضافية"}</summary><div className="structured-grid">{image("footerLogoUrl", en ? "Footer logo" : "شعار الفوتر")}{image("faviconUrl", en ? "Browser icon" : "أيقونة المتصفح")}{text("fontArabic", en ? "Arabic font" : "خط العربية")}{text("fontEnglish", en ? "English font" : "خط الإنجليزية")}{text("contact.address", en ? "Fallback address" : "العنوان البديل")}{["postal", "recruitment"].map(key => text("contact." + key, key === "postal" ? en ? "Postal code" : "الرمز البريدي" : en ? "Careers email" : "البريد الوظيفي"))}{["instagram", "facebook", "x", "tiktok"].map(key => text("socialLinks." + key, key))}</div></details>
  </div>;
  const optional = standard.filter(field => field.optional);
  const hasOptional = optional.some(field => ["ar", "en"].some(locale => { const content = getPath(value, "locales." + locale + "." + field.key); return Array.isArray(content) ? content.length > 0 : Boolean(content); }));
  return <div className="structured-record">
    {standard.filter(field => !field.optional).map(localizedField)}
    {["pages", "policies", "support"].includes(collection) && sectionEditor}
    {["programs", "courses", "news", "gallery"].includes(collection) && image("imageUrl", en ? "Image" : "الصورة")}
    {collection === "partners" && image("logoUrl", en ? "Partner logo" : "شعار الشريك")}
    {collection === "media" && (value.resourceType === "video" ? <video src={asText(value.url)} controls className="asset-preview" /> : image("url", en ? "Image" : "الصورة"))}
    {collection === "pages" && <Input name="path" label={en ? "Page address" : "عنوان الصفحة"} value={value.path} readOnly={value.id === (String(value.path || "").replace(/^\/+|\/+$/g, "").replaceAll("/", "__") || "home")} onChange={v => put("path", v)} />}
    {["resources", "calendar"].includes(collection) && text("url", en ? "Document link" : "رابط الوثيقة")}
    {collection === "calendar" && text("eventDate", en ? "Event date" : "تاريخ الفعالية", "date")}
    {collection === "forms" && <FormFields value={value} english={en} onChange={onChange} errors={errors} />}
    <details className="content-panel" open={hasOptional}><summary>{en ? "More details" : "المزيد من التفاصيل"}</summary>{optional.map(localizedField)}<div className="structured-grid">{["resources", "calendar"].includes(collection) && text("format", en ? "Document format" : "صيغة الوثيقة")}{collection === "partners" && text("href", en ? "Partner website" : "موقع الشريك")}{["policies", "support"].includes(collection) && text("documentUrl", en ? "Document link" : "رابط الوثيقة")}{["programs", "courses"].includes(collection) && <label className="structured-field"><span>{en ? "Featured on home page" : "إبراز في الرئيسية"}</span><input type="checkbox" checked={value.featured === true} onChange={e => put("featured", e.target.checked)} /></label>}</div></details>
  </div>;
}
function FormFields({ value, english: en, onChange, errors }: Pick<Props, "value" | "english" | "onChange" | "errors">) {
  const list = (locale: string) => { const raw = getPath(value, "locales." + locale + ".fields"); return Array.isArray(raw) ? raw as Array<Record<string, unknown>> : []; };
  const ar = list("ar"), english = list("en"), count = Math.max(ar.length, english.length);
  function sync(index: number, key: string, next: unknown) { let result = value; for (const lang of ["ar", "en"]) result = setPath(result, "locales." + lang + ".fields." + index + "." + key, next); onChange(result); }
  return <div className="content-sections"><h3>{en ? "Form fields" : "حقول النموذج"}</h3>{Array.from({ length: count }, (_, i) => { const field = ar[i] || english[i]; return <details className="content-panel" key={i} open><summary>{asText((en ? english[i] : ar[i])?.label) || (en ? "Field " : "الحقل ") + (i + 1)}</summary><BilingualField fieldKey={"fields." + i + ".label"} label={en ? "Label" : "التسمية"} errors={errors} /><BilingualField fieldKey={"fields." + i + ".placeholder"} label={en ? "Hint" : "نص إرشادي"} errors={errors} /><div className="structured-grid"><label className="structured-field"><span>{en ? "Answer type" : "نوع الإجابة"}</span><select value={asText(field.type) || "text"} onChange={e => sync(i, "type", e.target.value)}>{[["text", "نص قصير", "Short text"], ["email", "بريد إلكتروني", "Email"], ["tel", "هاتف", "Phone"], ["select", "قائمة اختيارات", "Choice list"], ["textarea", "نص طويل", "Long text"]].map(([id, ar, english]) => <option key={id} value={id}>{en ? english : ar}</option>)}</select></label><label className="structured-field"><span>{en ? "Required answer" : "إجابة إلزامية"}</span><input type="checkbox" checked={field.required === true} onChange={e => sync(i, "required", e.target.checked)} /></label></div>{field.type === "select" && <BilingualField fieldKey={"fields." + i + ".options"} label={en ? "Choices" : "الاختيارات"} list errors={errors} />}<button type="button" className="admin-secondary-button danger" onClick={() => { let result = value; for (const lang of ["ar", "en"]) result = setPath(result, "locales." + lang + ".fields", list(lang).filter((_, index) => index !== i)); onChange(result); }}>{en ? "Remove field" : "إزالة الحقل"}</button></details>; })}<button type="button" className="admin-secondary-button" onClick={() => {
    let result = value; const name = "field_" + crypto.randomUUID().slice(0, 8);
    for (const lang of ["ar", "en"]) { const fields = [...list(lang)]; while (fields.length < count) { const counterpart = (lang === "ar" ? english : ar)[fields.length]; fields.push({ ...counterpart, label: "", placeholder: "" }); } result = setPath(result, "locales." + lang + ".fields", [...fields, { name, label: "", type: "text", required: false }]); }
    onChange(result);
  }}><Plus size={14} />{en ? "Add field" : "إضافة حقل"}</button></div>;
}
