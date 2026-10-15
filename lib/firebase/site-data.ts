import "server-only";

import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getPublishedRecords, type PublicContentCollection, type PublicContentRecord } from "@/lib/firebase/public-content";
import type { Program } from "@/lib/types/content";

export { getPublishedRecords };

function recordString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function localized(record: PublicContentRecord, locale: "ar" | "en") {
  const locales = record.locales;
  if (locales && typeof locales === "object") {
    const entry = (locales as Record<string, unknown>)[locale];
    if (entry && typeof entry === "object") return entry as Record<string, unknown>;
  }
  return {};
}

export function toProgram(record: PublicContentRecord, collection: "programs" | "courses" = "programs"): Program {
  const ar = localized(record, "ar");
  const en = localized(record, "en");
  const slug = recordString(record.slug) || record.id;
  const isDiploma = record.isDiploma === true || record.type === "diploma" || record.category === "diploma";
  return {
    slug,
    href: recordString(record.href) || `${isDiploma ? "/programs" : "/courses"}/${slug}`,
    title: recordString(ar.title) || recordString(record.titleAr) || recordString(record.title),
    titleEn: recordString(en.title) || recordString(record.titleEn) || undefined,
    description: recordString(ar.description) || recordString(record.descriptionAr) || recordString(record.description),
    descriptionEn: recordString(en.description) || recordString(record.descriptionEn) || undefined,
    image: recordString(record.imageUrl) || recordString(record.image),
    category: recordString(ar.category) || recordString(record.category),
    categoryEn: recordString(en.category) || undefined,
    status: recordString(ar.status) || recordString(record.statusLabel),
    statusEn: recordString(en.status) || undefined,
    duration: recordString(ar.duration) || recordString(record.duration) || undefined,
    durationEn: recordString(en.duration) || undefined,
    hoursAndSchedule: recordString(ar.hoursAndSchedule) || undefined,
    targetAudience: recordString(ar.targetAudience) || undefined,
    pillars: Array.isArray(ar.pillars) ? ar.pillars.filter((item): item is string => typeof item === "string") : Array.isArray(record.pillars) ? record.pillars.filter((item): item is string => typeof item === "string") : [],
    outcomes: recordString(ar.outcomes) || undefined,
    careers: recordString(ar.careers) || undefined,
    requirements: recordString(ar.requirements) || undefined,
    documents: Array.isArray(ar.documents) ? ar.documents.filter((item): item is string => typeof item === "string") : [],
    source: recordString(record.source) || undefined,
    isDiploma,
  };
}

export async function getProgramBySlug(slug: string, collection: "programs" | "courses") {
  const records = await getPublishedRecords(collection);
  const match = records.find((record) => (record.slug === slug || record.id === slug) && record.status === "published");
  return match ? toProgram(match, collection) : null;
}

export async function getPublishedPageRecord(path: string) {
  if (!isFirebaseAdminConfigured()) return { state: "unavailable" as const, page: null };
  const id = path.replace(/^\/+|\/+$/g, "").replaceAll("/", "__") || "home";
  try {
    const snapshot = await getAdminDb().collection("pages").doc(id).get();
    const document = snapshot.data();
    if (!document) return { state: "missing" as const, page: null };
    if (document.status !== "published") return { state: "draft" as const, page: null };
    return { state: "published" as const, page: document };
  } catch (error) {
    console.error("Published page record read failed", error);
    return { state: "unavailable" as const, page: null };
  }
}

export async function getPublishedBrandRecord(): Promise<PublicContentRecord | null> {
  if (!isFirebaseAdminConfigured()) return null;
  try {
    const snapshot = await getAdminDb().collection("brand").doc("main").get();
    const data = snapshot.data();
    return data?.status === "published" ? { ...data, id: snapshot.id } : null;
  } catch (error) {
    console.error("Published brand read failed", error);
    return null;
  }
}

export function getLocalizedObject(record: PublicContentRecord, locale: "ar" | "en") {
  return localized(record, locale);
}

export async function getPublishedCollection(collection: PublicContentCollection) {
  return getPublishedRecords(collection);
}

