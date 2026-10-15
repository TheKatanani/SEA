import { Link } from "@/i18n/navigation";
import { ArrowUpLeft } from "lucide-react";

export type ContentCardItem = { title: string; description: string; href?: string; label?: string };

export function ContentCards({ items }: { items: ContentCardItem[] }) {
  return <div className="content-card-grid">{items.map((item) => {
    const body = <><strong>{item.title}</strong><p>{item.description}</p>{item.label && <span className="text-link">{item.label}<ArrowUpLeft size={15} /></span>}</>;
    return item.href
      ? <Link className="content-card" key={`${item.title}-${item.href}`} href={item.href}>{body}</Link>
      : <article className="content-card" key={item.title}>{body}</article>;
  })}</div>;
}

export function ContentNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="pending-note"><strong>{title}</strong>{children}</div>;
}
