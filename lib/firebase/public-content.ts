import "server-only";
import { publicRecord } from "@/lib/public-record";

import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const publicContentCollections = ["programs", "courses", "news", "calendar", "gallery", "faqs", "partners", "policies", "support", "admissions", "resources", "forms"] as const;
export type PublicContentCollection = (typeof publicContentCollections)[number];
export type PublicContentRecord = { id: string; [key: string]: unknown };

export function isPublicContentCollection(value: string): value is PublicContentCollection {
  return (publicContentCollections as readonly string[]).includes(value);
}

export async function getPublishedRecords(collection: PublicContentCollection): Promise<PublicContentRecord[]> {
  if (!isFirebaseAdminConfigured()) return [];
  try {
    const snapshot = await getAdminDb().collection(collection).where("status", "==", "published").limit(250).get();
    return snapshot.docs.map((document) => (publicRecord({ ...document.data(), id: document.id }) as PublicContentRecord));
  } catch (error) {
    console.error(`Published ${collection} read failed`, error);
    return [];
  }
}

export function localizedFields(record: PublicContentRecord, locale: "ar" | "en") {
  const locales = record.locales;
  if (locales && typeof locales === "object") {
    const translation = (locales as Record<string, unknown>)[locale];
    if (translation && typeof translation === "object") return translation as Record<string, unknown>;
  }
  return {};
}

