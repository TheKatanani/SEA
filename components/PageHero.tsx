import { Link } from "@/i18n/navigation";
import { ArrowUpLeft } from "lucide-react";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  compact?: boolean;
};

export function PageHero({ eyebrow, title, description, cta, compact = false }: PageHeroProps) {
  return (
    <section className={`page-hero ${compact ? "page-hero--compact" : ""}`}>
      <div className="page-hero__glow page-hero__glow--one" />
      <div className="page-hero__glow page-hero__glow--two" />
      <div className="page-shell page-hero__content">
        <p className="eyebrow eyebrow--light"><span className="eyebrow__dot" />{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="page-hero__description">{description}</p> : null}
        {cta ? <Link href={cta.href} className="button button--light">{cta.label}<ArrowUpLeft size={16} aria-hidden="true" /></Link> : null}
      </div>
    </section>
  );
}
