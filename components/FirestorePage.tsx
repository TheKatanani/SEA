import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getPublishedBrandRecord, getPublishedPageRecord, getPublishedRecords, toProgram } from "@/lib/firebase/site-data";
import { localizedFields, type PublicContentCollection, type PublicContentRecord } from "@/lib/firebase/public-content";
import { ManagedForm } from "@/components/ContactForm";
import { MotionCard, RevealSection } from "@/components/RevealSection";
import { GalleryGrid } from "@/components/GalleryGrid";
import { ProgramCard } from "@/components/ProgramCard";
import { CohortOptions } from "@/components/CohortOptions";
import { ArrowUpLeft, ArrowUpRight, ExternalLink, Mail, MapPin, Phone } from "lucide-react";

type Section = { type?: string; collection?: string; recordId?: string; formType?: string; heading?: string; body?: string; imageUrl?: string; imageAlt?: string; buttonLabel?: string; buttonUrl?: string };

const collections = new Set<PublicContentCollection>(["programs", "courses", "news", "calendar", "gallery", "faqs", "partners", "policies", "support", "admissions", "resources"]);
const formTypes = new Set(["quick_interest", "application_interest", "employer_inquiry", "future_diploma_interest", "contact_inquiry"]);

const routeContent: Record<string, { collections?: PublicContentCollection[]; form?: "quick_interest" | "application_interest" | "employer_inquiry" | "future_diploma_interest" | "contact_inquiry"; featuredRecord?: { collection: PublicContentCollection; id: string } }> = {
  "/": { collections: ["programs", "partners", "gallery"], form: "quick_interest" },
  "/about": { collections: ["programs", "partners"] },
  "/programs": { collections: ["programs", "courses"] },
  "/admission": { collections: ["admissions", "programs"] },
  "/apply": { collections: ["admissions"], form: "application_interest" },
  "/employers": { collections: ["partners"], form: "employer_inquiry" },
  "/gallery": { collections: ["gallery"] },
  "/accreditation": { collections: ["partners"] },
  "/accreditation/academie-paris": { featuredRecord: { collection: "partners", id: "partner-06" } },
  "/partners": { collections: ["partners"] },
  "/partners/cote-dazur": { featuredRecord: { collection: "partners", id: "partner-05" } },
  "/student-journey": { collections: ["admissions", "programs"], form: "application_interest" },
  "/policies": { collections: ["policies"] },
  "/support": { collections: ["support", "resources"] },
  "/contact": { form: "contact_inquiry" },
  "/news": { collections: ["resources"] },
  "/academic-calendar": { collections: ["calendar"] },
  "/faq": { collections: ["faqs"] },
  "/careers": { form: "contact_inquiry" },
  "/campaigns/future-diploma": { featuredRecord: { collection: "programs", id: "mice-management" }, form: "future_diploma_interest" },
};

function safeHref(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const url = new URL(value); if (url.protocol === "https:") return url.toString(); } catch {}
  return undefined;
}

function CmsCard({ record, locale, collection }: { record: PublicContentRecord; locale: "ar" | "en"; collection: string }) {
  const text = localizedFields(record, locale);
  const title = String(text.title || record.title || record.name || "");
  const description = String(text.description || text.summary || text.role || text.caption || record.description || "");
  const image = safeHref(record.imageUrl || record.logoUrl || (record.resourceType === "image" ? record.url : undefined));
  const partner = collection === "partners";
  const href = safeHref(record.href || record.documentUrl || record.url || (record.type === "diploma" ? `/programs/${record.slug || record.id}` : undefined));
  const content = <>{image && (record.type === "video" || record.resourceType === "video" ? <video className="cms-card__image" src={image} controls preload="metadata" aria-label={title} /> : <img className={`cms-card__image${partner ? " cms-card__image--logo" : ""}`} src={image} alt={String(text.alt || text.imageAlt || title)} loading="lazy" />)}{partner && !image && <div className="cms-card__image cms-card__image--logo cms-card__image--placeholder"><span>{title}</span></div>}<div className="cms-card__body">{title && <h3>{title}</h3>}{description && <p>{description}</p>}{typeof text.group === "string" && <small>{text.group}</small>}{typeof text.duration === "string" && <small>{text.duration}</small>}{typeof record.eventDate === "string" && <small>{record.eventDate}</small>}</div></>;
  const card = <>{content}{href && !href.startsWith("/") && <span className="cms-card__action">{locale === "en" ? "Open resource" : "فتح المستند"} <ExternalLink size={14} aria-hidden="true" /></span>}</>;
  return href?.startsWith("/") ? <Link className="cms-card" href={href} key={record.id}><MotionCard>{card}</MotionCard></Link> : href ? <a className="cms-card" href={href} target="_blank" rel="noreferrer" key={record.id}><MotionCard>{card}</MotionCard></a> : <MotionCard key={record.id}><article className="cms-card">{content}</article></MotionCard>;
}

function CmsCollection({ collection, items, locale }: { collection: string; items: PublicContentRecord[]; locale: "ar" | "en" }) {
  const english = locale === "en";
  if (!items.length) return <div className="cms-collection-state">{english ? "No published content is available yet." : "لا يوجد محتوى منشور حاليًا."}</div>;
  if (collection === "faqs") return <div className="cms-faq-list">{items.map((item) => { const text = localizedFields(item, locale); return <details key={item.id} className="cms-faq"><summary>{String(text.question || text.title || "")}</summary><p>{String(text.answer || text.body || "")}</p></details>; })}</div>;
  if (collection === "admissions") return <div className="cms-admission-list">{items.map((item) => { const text = localizedFields(item, locale); const requirements = Array.isArray(text.requirements) ? text.requirements : []; const docs = Array.isArray(text.documents) ? text.documents : []; return <article className="content-panel" key={item.id}><h3>{String(text.title || (english ? "Admission requirements" : "متطلبات القبول"))}</h3>{requirements.length > 0 && <ul>{requirements.map((value, index) => <li key={`r-${index}`}>{String(value)}</li>)}</ul>}{docs.length > 0 && <><h4>{english ? "Required documents" : "الوثائق المطلوبة"}</h4><ul>{docs.map((value, index) => <li key={`d-${index}`}>{String(value)}</li>)}</ul></>}</article>; })}</div>;
  if (collection === "programs" || collection === "courses") return <div className="program-grid">{items.map((record, index) => <ProgramCard key={record.id} program={toProgram(record, collection)} index={index} />)}</div>;
  const usefulItems = items.filter((item) => {
    const text = localizedFields(item, locale);
    const sectionBody = Array.isArray(text.sections) && text.sections.some((section) => section && typeof section === "object" && typeof (section as Record<string, unknown>).body === "string" && String((section as Record<string, unknown>).body).trim());
    return Boolean(text.title || text.question || item.title || item.name) && Boolean(text.description || text.summary || text.role || item.imageUrl || item.logoUrl || item.url || item.documentUrl || item.href || sectionBody);
  });
  if (!usefulItems.length) return <div className="cms-collection-state">{english ? "More information will be published here." : "ستُنشر معلومات إضافية هنا."}</div>;
  return <div className={`cms-collection-grid cms-collection-grid--${collection}`}>{usefulItems.slice(0, 36).map((record) => <CmsCard record={record} locale={locale} collection={collection} key={record.id} />)}</div>;
}

function SingleCmsRecord({ record, locale }: { record: PublicContentRecord; locale: "ar" | "en" }) {
  const text = localizedFields(record, locale);
  const image = safeHref(record.imageUrl || record.image);
  const sections = Array.isArray(text.sections) ? text.sections as Array<Record<string, unknown>> : [];
  const requirements = Array.isArray(text.requirements) ? text.requirements : [];
  const documents = Array.isArray(text.documents) ? text.documents : [];
  const careers = typeof text.careers === "string" ? text.careers : "";
  const outcomes = typeof text.outcomes === "string" ? text.outcomes : "";
  const role = typeof text.role === "string" ? text.role : "";
  const body = typeof text.body === "string" ? text.body : "";
  const summary = typeof text.summary === "string" ? text.summary : "";
  const pillars = Array.isArray(text.pillars) ? text.pillars : [];
  const documentUrl = safeHref(record.documentUrl || record.url);
  return <div className="cms-record-content">
    {image && <img className="cms-page__image" src={image} alt={String(text.imageAlt || text.title || "")} loading="lazy" />}
    {summary && <p>{summary}</p>}
    {role && <p>{role}</p>}
    {body && <p>{body}</p>}
    {typeof text.description === "string" && <p>{text.description}</p>}
    {typeof text.targetAudience === "string" && <section><h3>{locale === "en" ? "Who is this program for?" : "الفئة المستهدفة"}</h3><p>{text.targetAudience}</p></section>}
    {pillars.length > 0 && <section><h3>{locale === "en" ? "Training areas" : "المحاور التدريبية"}</h3><ul>{pillars.map((value, index) => <li key={index}>{String(value)}</li>)}</ul></section>}
    {outcomes && <section><h3>{locale === "en" ? "Learning outcomes" : "مخرجات التعلم"}</h3><p>{outcomes}</p></section>}
    {careers && <section><h3>{locale === "en" ? "Career opportunities" : "الفرص المهنية"}</h3><p>{careers}</p></section>}
    {requirements.length > 0 && <section><h3>{locale === "en" ? "Requirements" : "المتطلبات"}</h3><ul>{requirements.map((value, index) => <li key={index}>{String(value)}</li>)}</ul></section>}
    {documents.length > 0 && <section><h3>{locale === "en" ? "Required documents" : "الوثائق المطلوبة"}</h3><ul>{documents.map((value, index) => <li key={index}>{String(value)}</li>)}</ul></section>}
    {sections.filter((section) => typeof section.body === "string" && section.body.trim()).map((section, index) => <section key={index}><h3>{String(section.heading || "")}</h3><p>{String(section.body)}</p></section>)}
    {documentUrl && <a className="button button--primary" href={documentUrl} target="_blank" rel="noreferrer">{locale === "en" ? "Open document" : "فتح المستند"}</a>}
  </div>;
}

function hasRenderableSections(sections: Section[]) {
  return sections.some((section) => {
    if (section.type === "collection") return Boolean(section.collection && collections.has(section.collection as PublicContentCollection));
    if (section.type === "record") return Boolean(section.collection && collections.has(section.collection as PublicContentCollection) && section.recordId);
    if (section.type === "form") return formTypes.has(String(section.formType));
    return Boolean(section.body?.trim() || section.imageUrl || (section.buttonLabel && section.buttonUrl));
  });
}

function SectionBlock({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <RevealSection className={`section-pad cms-page__section ${className}`}><div className="page-shell"><div className="cms-page__copy"><h2>{title}</h2>{children}</div></div></RevealSection>;
}

function ContactDetails({ record, locale }: { record: PublicContentRecord | null; locale: "ar" | "en" }) {
  const localizedContact = record?.locales && typeof record.locales === "object" ? (record.locales as Record<string, Record<string, unknown>>)[locale]?.contact : undefined;
  const fallbackContact = record?.contact && typeof record.contact === "object" ? record.contact as Record<string, unknown> : {};
  const contact = localizedContact && typeof localizedContact === "object" ? { ...fallbackContact, ...localizedContact } : fallbackContact;
  const english = locale === "en";
  const email = typeof contact.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? contact.email : "";
  const phone = typeof contact.phone === "string" && /^\+?[\d\s()-]{7,}$/.test(contact.phone) ? contact.phone : "";
  const map = safeHref(contact.map);
  return <div className="contact-detail-grid">
    {typeof contact.address === "string" && contact.address && <article className="contact-card"><span className="contact-card__icon"><MapPin size={19} /></span><div><strong>{english ? "Academy campus" : "مقر الأكاديمية"}</strong><span>{contact.address}</span>{typeof contact.postal === "string" && <span>{contact.postal}</span>}{map && <a href={map} target="_blank" rel="noreferrer">{english ? "Open map" : "عرض الموقع"} <ExternalLink size={13} /></a>}</div></article>}
    {email && <article className="contact-card"><span className="contact-card__icon"><Mail size={19} /></span><div><strong>{english ? "Email" : "البريد الإلكتروني"}</strong><a href={`mailto:${email}`}>{email}</a></div></article>}
    {phone && <article className="contact-card"><span className="contact-card__icon"><Phone size={19} /></span><div><strong>{english ? "Phone" : "الهاتف"}</strong><a href={`tel:${phone.replace(/[^+\d]/g, "")}`} dir="ltr">{phone}</a></div></article>}
  </div>;
}

function ActionLinks({ locale, paths }: { locale: "ar" | "en"; paths: Array<{ href: string; label: string }> }) {
  const Arrow = locale === "en" ? ArrowUpRight : ArrowUpLeft;
  return <div className="button-row">{paths.map((item) => <Link className="button button--primary" href={item.href} key={item.href}>{item.label}<Arrow size={16} aria-hidden="true" /></Link>)}</div>;
}

function HomeHero({ locale, title, description, items }: { locale: "ar" | "en"; title: string; description: string; items: PublicContentRecord[] }) {
  const english = locale === "en";
  const photo = items.find((item) => safeHref(item.imageUrl || item.url));
  const photoText = photo ? localizedFields(photo, locale) : {};
  const imageUrl = photo ? safeHref(photo.imageUrl || photo.url) : undefined;
  const copy = <div className="home-hero__copy">
    <p className="eyebrow"><span className="eyebrow__dot" />{english ? "Saudi Entertainment Academy" : "الأكاديمية السعودية للترفيه"}</p>
    <h1>{title}</h1>
    {description && <p>{description}</p>}
    <ActionLinks locale={locale} paths={[{ href: "/programs", label: english ? "Explore programs" : "استكشف البرامج" }, { href: "/apply", label: english ? "Apply now" : "سجّل اهتمامك" }]} />
  </div>;

  return <RevealSection className={`home-hero home-hero--editorial${locale === "en" ? " home-hero--english" : ""}${imageUrl ? "" : " home-hero--text-only"}`}>
    <div className="page-shell home-hero__inner">{locale === "ar" && copy}{imageUrl && <figure className="home-hero__photo"><img src={imageUrl} alt={String(photoText.alt || photoText.title || photoText.caption || (english ? "SEA students and training" : "طلاب الأكاديمية وبيئة التدريب"))} fetchPriority="high" /><figcaption className="home-hero__photo-caption"><span>{english ? "Life at SEA" : "من الأكاديمية"}</span><strong>{String(photoText.title || photoText.caption || (english ? "Learning and entertainment" : "التعلم والترفيه"))}</strong></figcaption></figure>}{locale === "en" && copy}</div>
  </RevealSection>;
}

function RouteContent({ path, locale, page, plan, data, brand }: { path: string; locale: "ar" | "en"; page: PublicContentRecord | null; plan: (typeof routeContent)[string] | null; data: Map<string, PublicContentRecord[]>; brand: PublicContentRecord | null }) {
  const english = locale === "en";
  const headings: Record<string, string> = {
    programs: english ? "Explore our programs" : "اكتشف البرامج التدريبية",
    courses: english ? "Short courses" : "الدورات القصيرة",
    partners: english ? "Our partners" : "شركاؤنا",
    admissions: english ? "Admission requirements" : "شروط القبول",
    policies: english ? "Policies and regulations" : "السياسات واللوائح",
    support: english ? "Support resources" : "موارد الدعم",
    resources: english ? "Guides and documents" : "الأدلة والوثائق",
    calendar: english ? "Academic calendar" : "التقويم الأكاديمي",
    faqs: english ? "Frequently asked questions" : "الأسئلة الشائعة",
    gallery: english ? "Academy gallery" : "معرض الأكاديمية",
  };
  const detail = plan?.featuredRecord ? data.get(plan.featuredRecord.collection)?.find((item) => item.id === plan.featuredRecord?.id) : null;
  const detailCollection = plan?.featuredRecord?.collection;
  const title = String((detail && localizedFields(detail, locale).title) || (page && (localizedFields(page, locale).title || page.title)) || "");

  if (path === "/" && plan) return <>
    <SectionBlock title={headings.programs}><CmsCollection collection="programs" items={(data.get("programs") || []).slice(0, 3)} locale={locale} /><div className="cms-section-link"><Link className="text-link" href="/programs">{english ? "View all programs" : "عرض جميع البرامج"} <ArrowUpRight size={15} /></Link></div></SectionBlock>
    <SectionBlock title={headings.partners}><CmsCollection collection="partners" items={data.get("partners") || []} locale={locale} /></SectionBlock>
    <SectionBlock title={english ? "Register your interest" : "سجّل اهتمامك"} className="cms-form-section"><ManagedForm formType="quick_interest" /></SectionBlock>
  </>;

  if (detail && detailCollection) return <>
    <SectionBlock title={title || headings[detailCollection] || (english ? "Details" : "التفاصيل")} className="cms-detail-section"><SingleCmsRecord record={detail} locale={locale} />
      {["programs", "courses"].includes(detailCollection) && <ActionLinks locale={locale} paths={[{ href: `#cohorts-${detail.id}`, label: english ? "Book your seat" : "احجز مقعدك" }]} />}
      {detailCollection === "partners" && <ActionLinks locale={locale} paths={[{ href: "/partners", label: english ? "All partners" : "جميع الشركاء" }]} />}
    </SectionBlock>
    {plan?.form && <SectionBlock title={english ? "Register your interest" : "سجّل اهتمامك"} className="cms-form-section">{["programs", "courses"].includes(detailCollection) && <p>{english ? "This form registers interest only. To reserve and pay for a seat, choose a cohort above." : "هذا النموذج لتسجيل الاهتمام فقط. لحجز مقعد والدفع، اختر إحدى الدفعات أعلاه."}</p>}<ManagedForm formType={plan.form} /></SectionBlock>}
  </>;

  if (path === "/contact") return <>
    <SectionBlock title={english ? "Contact details" : "معلومات التواصل"}><ContactDetails record={brand} locale={locale} /></SectionBlock>
    <SectionBlock title={english ? "Send a message" : "أرسل رسالة"} className="cms-form-section"><ManagedForm formType="contact_inquiry" /></SectionBlock>
  </>;
  if (path === "/gallery") return <SectionBlock title={headings.gallery}><GalleryGrid /></SectionBlock>;
  if (path === "/careers") return <SectionBlock title={english ? "Career enquiries" : "استفسارات التوظيف"} className="cms-form-section"><ManagedForm formType="contact_inquiry" /></SectionBlock>;

  if (plan?.collections?.length || plan?.form) return <>
    {plan.collections?.map((collection) => {
      const records = data.get(collection) || [];
      const programOrCourse = collection === "programs" || collection === "courses";
      const limit = path === "/about" || path === "/admission" || path === "/student-journey" ? 3 : 36;
      const content = collection === "gallery" ? <GalleryGrid /> : <CmsCollection collection={collection} items={records.slice(0, programOrCourse ? limit : 36)} locale={locale} />;
      return <SectionBlock key={collection} title={headings[collection] || (english ? "Information" : "المعلومات")}>{content}</SectionBlock>;
    })}
    {plan.form && <SectionBlock title={english ? "Register your interest" : "سجّل اهتمامك"} className="cms-form-section"><ManagedForm formType={plan.form} /></SectionBlock>}
  </>;

  return <SectionBlock title={title || (english ? "Information" : "المعلومات")}><p className="cms-collection-state">{english ? "More information will be published here." : "ستُنشر معلومات إضافية هنا."}</p></SectionBlock>;
}

function PageSection({ section, locale }: { section: Section; locale: "ar" | "en" }) {
  const collection = section.collection && collections.has(section.collection as PublicContentCollection) ? section.collection as PublicContentCollection : null;
  const buttonUrl = safeHref(section.buttonUrl);
  return <RevealSection className={`section-pad cms-page__section cms-page__section--${section.type || "text"}`}>
    <div className="page-shell"><div className="cms-page__copy">
      {section.heading && <h2>{section.heading}</h2>}
      {section.type === "collection" && collection ? <CmsCollection collection={collection} items={[]} locale={locale} /> : null}
      {section.type === "record" && collection ? <div className="cms-collection-state">{locale === "en" ? "Content is unavailable." : "المحتوى غير متاح."}</div> : null}
      {section.type === "form" && formTypes.has(String(section.formType)) ? <ManagedForm formType={section.formType as "quick_interest" | "application_interest" | "employer_inquiry" | "future_diploma_interest" | "contact_inquiry"} /> : null}
      {(!section.type || section.type === "text") && <>{section.body?.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}{section.imageUrl && safeHref(section.imageUrl) && <img className="cms-page__image" src={section.imageUrl} alt={section.imageAlt || ""} loading="lazy" />}{section.buttonLabel && buttonUrl && <a className="button button--primary" href={buttonUrl}>{section.buttonLabel}</a>}</>}
    </div></div>
  </RevealSection>;
}

export async function FirestorePage({ path }: { path: string }) {
  const locale = (await getLocale()) as "ar" | "en";
  const english = locale === "en";
  const result = await getPublishedPageRecord(path);
  if (result.state === "unavailable") return <div className="cms-state page-shell"><h1>{english ? "Content is temporarily unavailable" : "المحتوى غير متاح مؤقتًا"}</h1><p>{english ? "Please try again shortly." : "يرجى المحاولة مرة أخرى بعد قليل."}</p></div>;
  const plan = routeContent[path] || null;
  const detailMatch = path.match(/^\/(programs|courses|partners|policies|resources|support)\/([^/]+)$/);
  let detailPlan = plan;
  if (!detailPlan && detailMatch) {
    const collection = detailMatch[1] as PublicContentCollection;
    detailPlan = { featuredRecord: { collection, id: decodeURIComponent(detailMatch[2]) }, ...(["programs", "courses"].includes(collection) ? { form: "application_interest" as const } : {}) };
  }
  const records = new Map<string, PublicContentRecord[]>();
  const collectionsNeeded = new Set<PublicContentCollection>([
    ...(plan?.collections || []),
    ...(detailPlan?.featuredRecord ? [detailPlan.featuredRecord.collection] : []),
  ]);
  const translation = result.state === "published" && result.page ? (result.page.locales as Record<string, Record<string, unknown>> | undefined)?.[locale] : undefined;
  const rawSections = Array.isArray(translation?.sections) ? translation.sections.slice(0, 30) as Section[] : [];
  for (const section of rawSections) if (section.collection && collections.has(section.collection as PublicContentCollection)) collectionsNeeded.add(section.collection as PublicContentCollection);
  const sections = hasRenderableSections(rawSections) ? rawSections : [];
  if (sections.length) {
    for (const section of sections) if (section.collection && collections.has(section.collection as PublicContentCollection)) collectionsNeeded.add(section.collection as PublicContentCollection);
  }
  await Promise.all([...collectionsNeeded].map(async (collection) => records.set(collection, await getPublishedRecords(collection))));
  const detailRecord = detailPlan?.featuredRecord ? records.get(detailPlan.featuredRecord.collection)?.find((item) => item.id === detailPlan?.featuredRecord?.id || item.slug === detailPlan?.featuredRecord?.id) : null;
  const bookingOptions = detailRecord && detailPlan?.featuredRecord && ["programs", "courses"].includes(detailPlan.featuredRecord.collection) ? <CohortOptions collection={detailPlan.featuredRecord.collection} programId={detailRecord.id} locale={locale} /> : null;
  if ((result.state === "missing" || !result.page) && !detailRecord && !plan) notFound();
  if (result.state !== "published" || !result.page) {
    const draft = result.state === "draft";
    if (detailRecord && detailPlan) {
      const isTraining = detailPlan.featuredRecord && ["programs", "courses"].includes(detailPlan.featuredRecord.collection);
      const detailHeroLinks = isTraining
        ? [{ href: `#cohorts-${detailRecord.id}`, label: english ? "Book your seat" : "احجز مقعدك" }, { href: "/apply", label: english ? "Register interest" : "سجّل اهتمامك" }]
        : [];
      return <article className="cms-page"><RevealSection className="cms-page__hero"><div className="page-shell"><p className="eyebrow"><span className="eyebrow__dot" />Saudi Entertainment Academy</p><h1>{String(localizedFields(detailRecord, locale).title || detailRecord.title || detailRecord.name || "")}</h1>{detailHeroLinks.length > 0 && <ActionLinks locale={locale} paths={detailHeroLinks} />}</div></RevealSection>{bookingOptions}<RouteContent path={path} locale={locale} page={null} plan={detailPlan} data={records} brand={null} /></article>;
    }
    if (draft) return <div className="cms-state page-shell"><span className="eyebrow"><span className="eyebrow__dot" />SEA</span><h1>{english ? "This page is being reviewed" : "هذه الصفحة قيد المراجعة"}</h1><p>{english ? "The Academy team is preparing the published version." : "يعمل فريق الأكاديمية على تجهيز النسخة المنشورة."}</p><Link className="button button--primary" href="/">{english ? "Back to home" : "العودة للرئيسية"}</Link></div>;
    notFound();
  }
  if (!translation || typeof translation.title !== "string") return <div className="cms-state page-shell"><h1>{english ? "This page is not available in this language" : "هذه الصفحة غير متاحة بهذه اللغة"}</h1></div>;
  const publishedSections = sections.map((section, index) => {
    const recordsForCollection = section.collection ? records.get(section.collection) || [] : [];
    if (section.type === "collection") return <RevealSection className="section-pad cms-page__section cms-page__section--collection" key={index}><div className="page-shell"><div className="cms-page__copy">{section.heading && <h2>{section.heading}</h2>}{section.collection === "gallery" ? <GalleryGrid /> : <CmsCollection collection={section.collection || ""} items={recordsForCollection} locale={locale} />}</div></div></RevealSection>;
    if (section.type === "record") {
      const record = recordsForCollection.find((item) => item.id === section.recordId);
      return <RevealSection className="section-pad cms-page__section cms-page__section--record" key={index}><div className="page-shell"><div className="cms-page__copy">{section.heading && <h2>{section.heading}</h2>}{record ? <SingleCmsRecord record={record} locale={locale} /> : <div className="cms-collection-state">{english ? "This content is not published yet." : "هذا المحتوى غير منشور حاليًا."}</div>}</div></div></RevealSection>;
    }
    return <PageSection section={section} locale={locale} key={index} />;
  });
  const configuredForms = new Set(sections.filter((section) => section.type === "form" && section.formType).map((section) => section.formType));
  const effectivePlan = plan || detailPlan;
  const requiredFormFallback = publishedSections.length && effectivePlan?.form && !configuredForms.has(effectivePlan.form)
    ? <SectionBlock title={english ? "Register your interest" : "سجّل اهتمامك"} className="cms-form-section"><ManagedForm formType={effectivePlan.form} /></SectionBlock>
    : null;
  const brand = path === "/contact" ? await getPublishedBrandRecord() : null;
  const isProgramDetail = Boolean(detailRecord && detailPlan?.featuredRecord && ["programs", "courses"].includes(detailPlan.featuredRecord.collection));
  const heroLinks = isProgramDetail && detailRecord
    ? [{ href: `#cohorts-${detailRecord.id}`, label: english ? "Book your seat" : "احجز مقعدك" }, { href: "/apply", label: english ? "Register interest" : "سجّل اهتمامك" }]
    : path === "/programs"
    ? [{ href: "/apply", label: english ? "Register interest" : "سجّل اهتمامك" }]
    : [];
  return <article className="cms-page">{path === "/" ? <HomeHero locale={locale} title={translation.title} description={typeof translation.description === "string" ? translation.description : ""} items={records.get("gallery") || []} /> : <RevealSection className="cms-page__hero"><div className="page-shell"><p className="eyebrow"><span className="eyebrow__dot" />{english ? "Saudi Entertainment Academy" : "الأكاديمية السعودية للترفيه"}</p><h1>{translation.title}</h1>{typeof translation.description === "string" && translation.description && <p>{translation.description}</p>}{heroLinks.length > 0 && <ActionLinks locale={locale} paths={heroLinks} />}</div></RevealSection>}{bookingOptions}{publishedSections.length ? <>{publishedSections}{requiredFormFallback}</> : <RouteContent path={path} locale={locale} page={result.page as PublicContentRecord} plan={effectivePlan} data={records} brand={brand} />}</article>;
}

export async function getFirestorePageMetadata(path: string, locale: "ar" | "en") {
  const result = await getPublishedPageRecord(path);
  if (result.state !== "published" || !result.page) return { title: "SEA", robots: { index: false, follow: false } };
  const translation = (result.page.locales as Record<string, Record<string, unknown>> | undefined)?.[locale];
  const title = typeof translation?.seoTitle === "string" ? translation.seoTitle : typeof translation?.title === "string" ? translation.title : "SEA";
  const description = typeof translation?.seoDescription === "string" ? translation.seoDescription : typeof translation?.description === "string" ? translation.description : undefined;
  return { title, description, alternates: { canonical: (locale === "en" ? "/en" : "") + (path === "/" ? "/" : path), languages: { ar: path, en: "/en" + (path === "/" ? "" : path) } }, robots: { index: true, follow: true } };
}
