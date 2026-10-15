import type { Program } from "@/lib/content";

const programDescriptions: Record<string, string> = {
  "entertainment-centers-management": "Prepare supervisors and managers to lead day-to-day operations at entertainment venues and centres using international practices.",
  "entertainment-centers-design": "Explore the planning of entertainment spaces, visitor flow, and the design of immersive, safe environments.",
  "crowd-management": "Develop the skills to manage, direct, and protect crowds at major events, festivals, and sports venues.",
  "video-games-developer": "Build technical and programming skills for video games, esports, and interactive experiences.",
  "entertainment-centers-maintenance": "Learn to maintain and operate electromechanical equipment, attractions, and entertainment facilities.",
  "entertainment-centers-safety": "Apply occupational health and safety practices, risk management, and inspection procedures for attractions and venues.",
  "mice-management": "Prepare for work in meetings, incentives, conferences, exhibitions, and events across Saudi Arabia.",
  "event-protocol": "Learn guest reception, formal protocol, and welcoming procedures for VIPs at events and seasonal occasions.",
  "customer-care": "Deliver excellent visitor experiences and respond to customer concerns in parks and at events.",
  "boutique-sales": "Build sales and merchandising skills for products at events and entertainment venues.",
  "conference-organization": "Learn the practical steps for organizing sessions, workshops, and venues at conferences.",
  "event-marketing": "Explore campaigns that attract audiences and build a clear identity for events and seasonal programs.",
};

const recordedShortCoursesEn = [
  "Reception Services",
  "Retail Operations and Sales Promotion",
  "Light Meal Service",
  "Customer Relations",
  "Promoting Saudi Seasons on Social Media",
  "Team Management for Supervisors and Coordinators",
  "Project Management for Supervisors and Coordinators",
  "Library Operations",
  "Museum Operations",
  "Customer Service Quality Follow-up",
  "Junior Photography Assistant",
  "Reception Services for Cafés and Food Activities",
  "Front Desk Sales Activities",
  "General Health and Safety",
  "Event Registration and Ticketing",
  "Introduction to Crowd Management",
  "Five-Star Customer Service",
  "Warehouse Management",
  "Level 2 Health and Safety Standards",
  "Level 2 Risk Assessment",
  "Crisis Management",
  "Hazard Identification",
  "Incident Investigation",
  "Level 2 Fire Safety",
  "Emergency Safety and First Aid",
  "Essential Safety and Operations Skills",
];

export function localizeProgram(program: Program, english: boolean): Program {
  if (!english) return program;
  return {
    ...program,
    title: program.titleEn ?? program.title,
    description: programDescriptions[program.slug] ?? "Explore practical skills for a career in entertainment and events.",
    category: program.isDiploma ? "Diploma" : "Live short course",
    status: program.isDiploma ? "Listed in the academy's program catalogue" : "Short-course listing",
    duration: program.isDiploma ? "Two academic years; four semesters" : "Short intensive course",
    hoursAndSchedule: undefined,
    targetAudience: undefined,
    pillars: [],
    outcomes: undefined,
    careers: undefined,
    requirements: undefined,
    documents: [],
  };
}

export function getRecordedShortCourses(english: boolean) {
  if (!english) return undefined;
  return recordedShortCoursesEn;
}

export const admissionRequirementsEn = [
  "Applicants must be Saudi nationals.",
  "Applicants must be between 18 and 30 years old.",
  "Applicants must hold a high school certificate or higher.",
  "Applicants must not hold an active commercial registration.",
  "Applicants must not currently be employed.",
  "Applicants must not be registered with social insurance.",
  "Applicants must not have previously received support from the Human Resources Development Fund (HRDF).",
  "Applicants must be available full-time and attend the full program at the Saudi Entertainment Academy.",
  "Applicants must pass the English placement test.",
  "Applicants must complete the career-interest assessment.",
  "Applicants must pass interviews with the Academy and the hiring company.",
];

export const requiredDocumentsEn = [
  "A copy of the national ID card.",
  "The original certificate for the highest qualification completed.",
  "A copy of the CV, if available.",
];

export const partnerGroupLabelsEn: Record<string, string> = {
  "الشريك الاستراتيجي": "Strategic partner",
  "الجهات الوطنية": "National entities",
  "الشريك الأكاديمي الدولي": "International academic partner",
};

export const partnerNameTranslations: Record<string, string> = {
  "الهيئة العامة للترفيه (GEA)": "General Entertainment Authority (GEA)",
  "المؤسسة العامة للتدريب التقني والمهني (TVTC)": "Technical and Vocational Training Corporation (TVTC)",
  "صندوق تنمية الموارد البشرية (هدف)": "Human Resources Development Fund (HRDF)",
  "كليات التميز (CoE)": "Colleges of Excellence (CoE)",
  "جامعة كوت دازور (فرنسا)": "Université Côte d’Azur (France)",
  "أكاديمية باريس الدولية": "Académie de Paris",
};

export const recordedCourseEnglishTitles = recordedShortCoursesEn;

export const galleryCaptionsEn = [
  "A gathering from the SEA community", "Learning and training", "Hands-on training", "Learning through interaction",
  "A training session", "Inside the classroom", "Building skills", "Learning spaces", "Digital learning",
  "Computer-based practice", "A learning experience", "Academy programs", "Technical training", "The Academy at night",
  "The Academy building", "The Academy in Riyadh", "Partnership signing", "An Academy event",
];

export const galleryAltsEn = [
  "Academy trainees and partners at an official gathering", "Trainees in an Academy classroom", "A trainer speaking to a classroom",
  "A trainer engaging with trainees", "Trainees attending a class", "Trainees following a learning session",
  "A trainer explaining a topic to trainees", "Trainees in an Academy training room", "A trainee following a lesson on a computer",
  "Trainees using computers in a classroom", "A trainee wearing a headset during a learning session",
  "Saudi Entertainment Academy program poster", "A trainee using a computer workstation", "The Academy building illuminated at night",
  "Saudi Entertainment Academy building during the day", "Saudi Entertainment Academy campus in Riyadh",
  "Academy and partner representatives signing an agreement", "A document signing at an official event",
];

export const galleryVideoTextEn: Record<string, { title: string; kind: string }> = {
  "الأكاديمية السعودية للترفيه": { title: "Saudi Entertainment Academy", kind: "About the Academy" },
  "مبادرة صناع السعادة": { title: "Happiness Makers Initiative", kind: "Initiative" },
  "30 دورة تدريبية إلكترونية": { title: "30 Online Training Courses", kind: "Training" },
};

export const faqsEn = [
  { question: "What are the diploma admission requirements?", answer: "Review the eligibility requirements and required documents on the Admissions page. Confirm the open intake and program requirements with the Academy before applying." },
  { question: "Which documents do I need?", answer: "A copy of your national ID, the original certificate for your highest qualification, and a copy of your CV if available." },
  { question: "How do I apply to a program?", answer: "Submit the application of interest. This version is a demo and does not send or store information; the Academy must enable the application service before accepting submissions." },
  { question: "Are the programs connected to employment?", answer: "The site lists training pathways connected to sector needs. Confirm current employment arrangements and eligibility for each intake with the Academy." },
];

export const policyEnglish: Record<string, { title: string; summary: string; topics: string[]; documentTitle?: string }> = {
  "academic-honesty": { title: "Academic Integrity Policy", summary: "A summary of expectations for students, faculty, and staff, including honest individual and collaborative work and attribution of others' contributions.", topics: ["General principles of academic integrity", "Cheating, plagiarism, and falsification", "Investigations and disciplinary action"] },
  attendance: { title: "Student Attendance Policy", summary: "A summary of attendance expectations for in-person and online learning, labs, studios, field work, and assessments.", topics: ["Attendance and participation objectives", "Policy scope", "Course attendance requirements during the add/drop period"], documentTitle: "Attendance Policy — Version 4 (PDF)" },
  complaints: { title: "Complaints and Appeals Procedure", summary: "A summary of the Academy's student support approach and how to raise an issue that affects the learning experience.", topics: ["Contact the relevant team or supervisor", "Formal appeal procedure"], documentTitle: "Complaints Policy and Procedure — Volume 1 (DOCX)" },
  "intellectual-property": { title: "Intellectual Property Guidelines", summary: "Guidance on intellectual property rights for trainers and trainees, including original work, patents, copyright, and trademarks.", topics: ["Original work and innovation", "Copyright, patents, and trademarks"] },
  privacy: { title: "Privacy Policy", summary: "A summary of how the Academy describes its handling of personal information submitted for enquiries, support, and operations.", topics: ["General provisions", "Collection and use of information"] },
};

export const supportEnglish: Record<string, { title: string; topics: string[] }> = {
  "trainee-guide": { title: "Trainee User Guide", topics: ["E-learning satisfaction survey", "Requesting support", "Finding course materials", "Enrolling in a new course", "Rating and commenting on content", "Taking an assessment", "Updating personal information", "Verifying identity", "Introduction to e-learning"] },
  "trainer-guide": { title: "Trainer User Guide", topics: ["Learner satisfaction survey", "Creating an assessment", "Trainer sign-in", "Creating a virtual classroom", "Managing course content", "Managing live course schedules", "Measuring satisfaction (AR/EN)", "Following trainee progress (AR/EN)"] },
  "e-learning": { title: "E-learning Guidance", topics: ["Trainer user guide", "Trainee user guide"] },
};

export const resourceDocumentEnglish: Record<string, { title: string; category: string }> = {
  "دليل المتدرب (Trainee Handbook)": { title: "Trainee Handbook", category: "Trainee guides" },
  "إجراءات التقييم الأكاديمي — الإصدار 2.0": { title: "Academic Assessment Policy and Procedures — Version 2.0", category: "Academic policies" },
  "سياسة التنوع والعدالة والشمول": { title: "Diversity, Equity and Inclusion Policy", category: "Institutional policies" },
  "حقوق وواجبات المتدربين — المجلد الأول": { title: "Trainee Rights and Responsibilities — Volume 1", category: "Trainee regulations" },
  "لائحة المتدربين ذوي الاحتياجات الخاصة — المجلد الأول": { title: "Special Needs Trainees — Volume 1", category: "Trainee regulations" },
  "سياسة الحضور — الإصدار الرابع": { title: "Attendance Policy — Version 4", category: "Academic policies" },
  "إجراءات الشكاوى والتظلمات — المجلد الأول": { title: "Complaints Policy and Procedure — Volume 1", category: "Academic policies" },
};
