"use client";

import { usePathname } from "@/i18n/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdmin) return <main className="admin-page-main">{children}</main>;

  return <>
    <SiteHeader />
    <main>{children}</main>
    <SiteFooter />
  </>;
}
