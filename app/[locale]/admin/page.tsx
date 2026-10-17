import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import "../../admin.css";
import { AdminConsole } from "@/components/AdminConsole";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata(): Promise<Metadata> {
  const english = (await getLocale()) === "en";
  return { title: english ? "Admin panel" : "لوحة الإدارة", robots: { index: false, follow: false } };
}

export default function AdminPage() {
  return <AdminConsole />;
}
