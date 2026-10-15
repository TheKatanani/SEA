import audit from "../data/claude-content-payload.json";

export type Program = {
  slug: string;
  href: string;
  title: string;
  titleEn?: string;
  description: string;
  image: string;
  category: string;
  status: string;
  duration?: string;
  hoursAndSchedule?: string;
  targetAudience?: string;
  pillars: string[];
  outcomes?: string;
  careers?: string;
  requirements?: string;
  documents: string[];
  source: string;
  isDiploma: boolean;
};

const programImages: Record<string, string> = {
  "entertainment-centers-management": "/gallery/photo-08.jpg",
  "entertainment-centers-design": "/gallery/photo-16.jpg",
  "crowd-management": "/figma-assets/d1cfb.png",
  "video-games-developer": "/gallery/photo-10.jpg",
  "entertainment-centers-maintenance": "/figma-assets/145c5.png",
  "entertainment-centers-safety": "/gallery/photo-12.jpg",
  "mice-management": "/gallery/photo-17.jpg",
  "event-protocol": "/gallery/photo-01.jpg",
  "customer-care": "/gallery/photo-04.jpg",
  "boutique-sales": "/gallery/photo-13.jpg",
  "conference-organization": "/gallery/photo-05.jpg",
  "event-marketing": "/gallery/photo-14.jpg",
};

const auditedPrograms: Program[] = audit.programs.map((item) => {
  const slug = item.slug_next_proposed.split("/").at(-1) ?? item.id.toLowerCase();
  return {
  slug,
  href: item.slug_next_proposed,
  title: item.name_ar,
  titleEn: item.name_en,
  description: item.summary_ar,
  category: item.category,
  status: item.status,
  duration: item.duration,
  hoursAndSchedule: item.hours_and_schedule,
  targetAudience: item.target_audience,
  pillars: item.training_pillars ?? [],
  outcomes: item.learning_outcomes,
  careers: item.career_opportunities,
  requirements: item.requirements,
  documents: item.required_documents ?? [],
  source: item.source,
  isDiploma: item.category.includes("Diploma") || item.category.includes("دبلوم"),
  image: programImages[slug] ?? "/gallery/photo-03.jpg",
  };
});

export const diplomaPrograms = auditedPrograms.filter((program) => program.isDiploma);
export const liveShortCourses = auditedPrograms.filter((program) => !program.isDiploma);
export const allProgramPages = auditedPrograms;
export const featuredPrograms = diplomaPrograms.slice(0, 4);
export const currentPrograms = liveShortCourses;
export const programCounts = { directoryDiplomas: 6, liveShortCourses: 5, recordedShortCourses: 26, auditedDiplomas: diplomaPrograms.length };
export const recordedShortCourses = [
  "خدمات الاستقبال",
  "تنظيم المتاجر وترويج المبيعات",
  "خدمة تقديم وجبات الطعام الخفيفة",
  "علاقات العملاء",
  "الترويج للمواسم السعودية عبر وسائل التواصل الاجتماعي",
  "إدارة فريق العمل (للمشرفين والمنسقين)",
  "إدارة المشاريع (للمشرفين والمنسقين)",
  "تنظيم المكتبة",
  "تنظيم المتحف",
  "خدمة العملاء (متابعة جودة الخدمات)",
  "مساعد مصور مبتدئ",
  "خدمات الاستقبال (المقاهي/أنشطة تقديم الطعام)",
  "أنشطة مكتب الاستقبال (المبيعات)",
  "الأمن والسلامة العامة",
  "التسجيل في الفعاليات وإصدار التذاكر",
  "مقدمة في إدارة الحشود",
  "خدمة العملاء المميزين (5 نجوم)",
  "إدارة المستودعات",
  "المستوى الثاني في معايير الصحة والسلامة",
  "المستوى الثاني في تقييم المخاطر",
  "إدارة الأزمات",
  "تحديد المخاطر",
  "التحقيق بالحوادث",
  "المستوى الثاني في السلامة من الحرائق",
  "ضمان السلامة في حالات الطوارئ وتأمين الإسعافات الأولية",
  "المهارات الأساسية للسلامة والتشغيل",
];

export const admissionRequirements = audit.admissions.conditions_verbatim_ar.map((item) => item.replace(/^\d+\s*[-–.]\s*/, ""));
export const requiredDocuments = audit.admissions.required_documents_verbatim_ar.map((item) => item.replace(/^[-–.]\s*/, ""));

export const partnerGroups = [
  { title: "الشريك الاستراتيجي", names: ["الهيئة العامة للترفيه (GEA)"] },
  { title: "الجهات الوطنية", names: ["المؤسسة العامة للتدريب التقني والمهني (TVTC)", "صندوق تنمية الموارد البشرية (هدف)", "كليات التميز (CoE)"] },
  { title: "الشريك الأكاديمي الدولي", names: ["جامعة كوت دازور (فرنسا)", "أكاديمية باريس الدولية"] },
];

export const galleryPhotos = [
  { src: "/gallery/photo-01.jpg", alt: "متدربون وشركاء للأكاديمية في لقاء رسمي", caption: "لقاء من مجتمع الأكاديمية" },
  { src: "/gallery/photo-02.jpg", alt: "متدربون في قاعة تدريب بالأكاديمية", caption: "تعلّم وتدريب" },
  { src: "/gallery/photo-03.jpg", alt: "مدرب يشرح أمام المتدربين في قاعة تدريب", caption: "التدريب العملي" },
  { src: "/gallery/photo-04.jpg", alt: "مدرب يتفاعل مع المتدربين أثناء الشرح", caption: "التعلّم بالتفاعل" },
  { src: "/gallery/photo-05.jpg", alt: "متدربون في قاعة محاضرات خلال جلسة تدريب", caption: "جلسة تدريبية" },
  { src: "/gallery/photo-06.jpg", alt: "متدربون يتابعون جلسة تعليمية في الأكاديمية", caption: "داخل قاعة التدريب" },
  { src: "/gallery/photo-07.jpg", alt: "مدرب يقدم شرحًا لمجموعة من المتدربين", caption: "خبرات ومهارات" },
  { src: "/gallery/photo-08.jpg", alt: "قاعة تدريب تضم مجموعة من متدربي الأكاديمية", caption: "مساحات التعلّم" },
  { src: "/gallery/photo-09.jpg", alt: "متدرب يتابع درسًا عبر الحاسوب", caption: "التعلّم الرقمي" },
  { src: "/gallery/photo-10.jpg", alt: "متدربون يستخدمون الحواسيب في قاعة التدريب", caption: "تطبيق على الحاسوب" },
  { src: "/gallery/photo-11.jpg", alt: "متدرب يستخدم سماعة خلال جلسة تعليمية", caption: "تجربة تعليمية" },
  { src: "/gallery/photo-12.jpg", alt: "ملصق تعريفي ببرامج الأكاديمية السعودية للترفيه", caption: "برامج الأكاديمية" },
  { src: "/gallery/photo-13.jpg", alt: "متدرب يستخدم محطة حاسوب في قاعة الأكاديمية", caption: "تدريب تقني" },
  { src: "/gallery/photo-14.jpg", alt: "مبنى الأكاديمية السعودية للترفيه مضاءً في المساء", caption: "الأكاديمية ليلًا" },
  { src: "/gallery/photo-15.jpg", alt: "واجهة مبنى الأكاديمية السعودية للترفيه في النهار", caption: "مقر الأكاديمية" },
  { src: "/gallery/photo-16.jpg", alt: "مبنى الأكاديمية السعودية للترفيه من الخارج", caption: "الأكاديمية في الرياض" },
  { src: "/gallery/photo-17.jpg", alt: "مراسم توقيع شراكة بحضور ممثلين عن الأكاديمية وشركائها", caption: "تعاون وشراكات" },
  { src: "/gallery/photo-18.jpg", alt: "توقيع وثيقة خلال مناسبة رسمية", caption: "من مناسبات الأكاديمية" },
];

export const galleryVideos = [
  { title: "الأكاديمية السعودية للترفيه", duration: "01:06", image: "/gallery/video-sea.jpg", kind: "تعريف بالأكاديمية" },
  { title: "مبادرة صناع السعادة", duration: "00:49", image: "/gallery/video-happiness.jpg", kind: "مبادرة" },
  { title: "30 دورة تدريبية إلكترونية", duration: "01:05", image: "/gallery/video-courses.jpg", kind: "التدريب" },
];

export const faqs = [
  { question: "ما شروط الالتحاق بالدبلومات؟", answer: "تظهر شروط الالتحاق والمستندات المطلوبة في صفحة القبول. راجع الأكاديمية للتأكد من الشروط والدفعة المفتوحة قبل التقديم." },
  { question: "ما المستندات المطلوبة؟", answer: requiredDocuments.join("، ") },
  { question: "كيف أقدّم على أحد البرامج؟", answer: "يمكنك تعبئة نموذج الاهتمام التجريبي. هذه النسخة لا ترسل البيانات أو تحفظها، وسيحتاج ربط التقديم اعتماد الأكاديمية." },
  { question: "هل البرامج مرتبطة بالتوظيف؟", answer: "تعرض صفحات الموقع البرامج ضمن مسارات تدريب مرتبطة باحتياج القطاع. تحقق من حالة كل برنامج وشروط التوظيف للدفعة الحالية." },
];

export const contactDetails = {
  phone: "+966 500245151",
  email: "Info@saea.sa",
  recruitment: "recruitment@saea.sa",
  address: "فرع الربوة، الرياض، المملكة العربية السعودية",
  postal: "صندوق بريد 50983، الرياض 11533",
  map: "https://goo.gl/maps/r17QNRDvan8vUkjA6",
};

export const socialLinks = [
  { label: "Facebook", platform: "facebook", href: "https://www.facebook.com/SaudiEntmtAcad" },
  { label: "X", platform: "x", href: "https://twitter.com/se_acdmy" },
  { label: "Instagram", platform: "instagram", href: "https://www.instagram.com/se_acdmy/" },
];

export const auditOpenQuestions = audit.open_questions;
