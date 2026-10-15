import type { Metadata } from "next";
import { FirestorePage, getFirestorePageMetadata } from "@/components/FirestorePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return getFirestorePageMetadata("/", locale === "en" ? "en" : "ar");
}

export default function HomePage() {
  return <FirestorePage path="/" />;
}
