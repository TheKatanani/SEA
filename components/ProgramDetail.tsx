import Image from "next/image";
import { useLocale } from "next-intl";
import { ArrowUpLeft, ArrowUpRight, BriefcaseBusiness, Check, Clock3, GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Program } from "@/lib/types/content";
import { PageHero } from "@/components/PageHero";

export function ProgramDetail({ program, course = false }: { program: Program; course?: boolean }) {
  const english = useLocale() === "en";
  const title = english ? program.titleEn || program.title : program.title;
  const description = english ? program.descriptionEn || program.description : program.description;
  const category = english ? program.categoryEn || program.category : program.category;
  const status = english ? program.statusEn || program.status : program.status;
  const duration = english ? program.durationEn || program.duration : program.duration;
  const Arrow = english ? ArrowUpRight : ArrowUpLeft;

  return <>
    <PageHero
      eyebrow={course ? english ? "Short courses" : "الدورات القصيرة" : english ? "Diplomas" : "الدبلومات"}
      title={title}
      description={description}
      compact
      cta={{ label: course ? english ? "Explore programs" : "استكشف البرامج" : english ? "Apply" : "تقديم طلب اهتمام", href: course ? "/programs" : "/apply" }}
    />
    <section className="section-pad"><div className="page-shell program-detail">
      <div className="content-panel">
        <p className="eyebrow"><span className="eyebrow__dot" />{english ? `About the ${course ? "course" : "program"}` : `عن ${course ? "الدورة" : "البرنامج"}`}</p>
        <h2>{title}</h2>
        <p className="page-intro">{description}</p>
        {status && <p className="source-note">{status}</p>}
        {!english && program.targetAudience && <><h2><GraduationCap size={20} /> الفئة المستهدفة</h2><p>{program.targetAudience}</p></>}
        {!english && !!program.pillars.length && <><h2>محاور التدريب</h2><ul className="check-list">{program.pillars.map((pillar) => <li key={pillar}><Check size={18} />{pillar}</li>)}</ul></>}
        {!english && program.outcomes && <><h2>المخرجات التعليمية</h2><p>{program.outcomes}</p></>}
        {!english && program.careers && <><h2><BriefcaseBusiness size={20} /> فرص مهنية</h2><p>{program.careers}</p></>}
        {!english && (program.requirements || !!program.documents.length) && <><h2>متطلبات البرنامج</h2>{program.requirements && <p>{program.requirements}</p>}{!!program.documents.length && <ul className="check-list">{program.documents.map((item) => <li key={item}><Check size={18} />{item}</li>)}</ul>}</>}
      </div>
      <aside className="program-detail__aside">
        <div className="program-detail__visual">{program.image ? <Image src={program.image} alt={title} fill sizes="(max-width: 760px) 100vw, 38vw" unoptimized /> : <div className="program-card__placeholder" aria-hidden="true"><GraduationCap size={48} /></div>}</div>
        <div className="program-detail__hero"><p>{course ? english ? "Short course" : "دورة قصيرة" : category}</p><h2>{title}</h2><p>{status}</p></div>
        <div className="content-panel" style={{ marginTop: 16 }}>
          <h3><Clock3 size={18} /> {english ? "Duration and schedule" : "المدة والجدول"}</h3>
          {duration && <p>{duration}</p>}
          {program.hoursAndSchedule && <p>{program.hoursAndSchedule}</p>}
          <Link className="button button--primary" href={course ? "/contact" : "/apply"}>{course ? english ? "Ask about this course" : "استفسر عن الدورة" : english ? "Start an application" : "ابدأ طلب الاهتمام"}<Arrow size={16} /></Link>
        </div>
      </aside>
    </div></section>
  </>;
}
