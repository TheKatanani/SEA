import { getPublishedRecords, isPublicContentCollection } from "@/lib/firebase/public-content";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateKeyPattern = /internal|secret|token|password|consent|ipaddress|createdby|updatedby|actoruid/i;

function toPublicValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPublicValue);
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate as () => Date)().toISOString();
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !privateKeyPattern.test(key)).map(([key, item]) => [key, toPublicValue(item)]));
  }
  return value;
}

export async function GET(request: NextRequest) {
  const collection = request.nextUrl.searchParams.get("collection") || "";
  if (!isPublicContentCollection(collection)) return Response.json({ error: "Collection unavailable" }, { status: 404 });
  const items = await getPublishedRecords(collection);
  return Response.json({ items: items.map(toPublicValue) }, { headers: { "Cache-Control": "no-store" } });
}
