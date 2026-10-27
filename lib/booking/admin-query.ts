import "server-only";
import type { NextRequest } from "next/server";
import type { Query } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { BookingError, idSchema } from "./domain";
export const trainingCollections = ["cohorts", "bookings", "payments"] as const;
export function trainingQuery(request: NextRequest) {
  const collection = request.nextUrl.searchParams.get("collection") || "cohorts";
  if (!(trainingCollections as readonly string[]).includes(collection)) throw new BookingError("INVALID_COLLECTION", 400);
  let query: Query = getAdminDb().collection(collection);
  const status = request.nextUrl.searchParams.get("status");
  const cohort = request.nextUrl.searchParams.get("cohortId");
  const search = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  if (status) query = query.where("status", "==", status.slice(0, 40));
  if (cohort && collection !== "cohorts") query = query.where("cohortId", "==", idSchema.parse(cohort));
  if (search) {
    if (collection !== "bookings") throw new BookingError("SEARCH_BOOKINGS_ONLY", 400);
    query = query.where("searchTokens", "array-contains", search.slice(0, 100));
  }
  if (collection === "cohorts" && request.nextUrl.searchParams.has("programId")) {
    const programCollection = request.nextUrl.searchParams.get("programCollection");
    if (!["programs", "courses"].includes(programCollection || "")) throw new BookingError("INVALID_QUERY", 400);
    query = query.where("programCollection", "==", programCollection).where("programId", "==", idSchema.parse(request.nextUrl.searchParams.get("programId")));
  }
  const rawQuery = query;
  return { collection, rawQuery, query: query.orderBy(collection === "payments" ? "updatedAt" : "createdAt", "desc") };
}
