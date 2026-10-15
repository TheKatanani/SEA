import type { Metadata } from "next";
import { FirestorePage, getFirestorePageMetadata } from "@/components/FirestorePage";

export const dynamic = "force-dynamic";

type RouteParams = { locale: string; slug: string[] };

function routePath(slug: string[]) {
  return `/${slug.map((part) => encodeURIComponent(part)).join("/")}`;
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { locale, slug } = await params;
  return getFirestorePageMetadata(routePath(slug), locale === "en" ? "en" : "ar");
}

export default async function PublicCmsRoute({ params }: { params: Promise<RouteParams> }) {
  const { slug } = await params;
  return <FirestorePage path={routePath(slug)} />;
}
