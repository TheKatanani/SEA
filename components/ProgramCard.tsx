import Image from "next/image";
import { useLocale } from "next-intl";
import { ArrowUpLeft, ArrowUpRight, GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Program } from "@/lib/types/content";

export function ProgramCard({ program, index = 0 }: { program: Program; index?: number }) {
  const english = useLocale() === "en";
  const title = english ? program.titleEn || program.title : program.title;
  const description = english ? program.descriptionEn || program.description : program.description;
  const Arrow = english ? ArrowUpRight : ArrowUpLeft;

  return (
    <article className="program-card">
      <Link href={program.href} className="program-card__link" aria-label={english ? `Details for ${title}` : `تفاصيل برنامج ${title}`}>
        <div className={`program-card__image program-card__image--tone-${index % 4}`}>
          {program.image ? <Image src={program.image} alt={english ? `${title} program` : `صورة ${title}`} width={640} height={360} unoptimized /> : <span className="program-card__placeholder" aria-hidden="true"><GraduationCap size={42} /></span>}
          <span className="program-card__badge">{program.isDiploma ? english ? "Diploma" : "دبلوم" : english ? "Live course" : "دورة مباشرة"}</span>
        </div>
        <div className="program-card__body">
          <div className="program-card__meta"><span>{english ? "Saudi Entertainment Academy" : "الأكاديمية السعودية للترفيه"}</span><span className="program-card__arrow"><Arrow size={15} /></span></div>
          <h3>{title}</h3>
          <p>{description}</p>
          <span className="text-link">{english ? "Explore program" : "اكتشف البرنامج"} <Arrow size={15} aria-hidden="true" /></span>
        </div>
      </Link>
    </article>
  );
}
