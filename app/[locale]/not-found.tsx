import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const english = (await getLocale()) === "en";
  return <main className="cms-state page-shell">
    <span className="eyebrow"><span className="eyebrow__dot" />SEA</span>
    <h1>{english ? "This page could not be found" : "لم نعثر على هذه الصفحة"}</h1>
    <p>{english ? "Check the address or go back to the Academy home page." : "تحقق من العنوان أو ارجع إلى الصفحة الرئيسية للأكاديمية."}</p>
    <Link className="button button--primary" href="/">{english ? "Back to home" : "العودة للرئيسية"}</Link>
  </main>;
}
