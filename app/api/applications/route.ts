import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const formTypes = ["quick_interest", "application_interest", "employer_inquiry", "future_diploma_interest", "contact_inquiry"] as const;
const schema = z.object({
  formType: z.enum(formTypes),
  locale: z.enum(["ar", "en"]),
  fields: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/), z.string().trim().max(2_000)),
  privacyConsent: z.literal(true),
  website: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  if (process.env.APPLICATIONS_ENABLED !== "true") return Response.json({ error: "Submissions are not enabled yet" }, { status: 503 });
  if (!process.env.PRIVACY_POLICY_VERSION || process.env.PRIVACY_POLICY_VERSION === "pending-approval") return Response.json({ error: "Privacy policy is not configured" }, { status: 503 });
  if (!isFirebaseAdminConfigured()) return Response.json({ error: "Application storage is not configured" }, { status: 503 });
  if (!process.env.FIREBASE_RATE_LIMIT_SECRET) return Response.json({ error: "Submission protection is not configured" }, { status: 503 });
  const origin = request.headers.get("origin");
  const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (origin && expectedHost) {
    try {
      if (new URL(origin).host !== expectedHost) return Response.json({ error: "Invalid request origin" }, { status: 403 });
    } catch {
      return Response.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 32_000) return Response.json({ error: "Request is too large" }, { status: 413 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Please review the required fields" }, { status: 400 });
  }
  if (body.website) return Response.json({ ok: true });
  let formDefinition: Record<string, unknown> | undefined;
  try {
    const formSnapshot = await getAdminDb().collection("forms").doc(body.formType).get();
    formDefinition = formSnapshot.data();
  } catch (error) {
    console.error("Form definition read failed", error);
    return Response.json({ error: "The form is temporarily unavailable" }, { status: 503 });
  }
  if (formDefinition?.status !== "published") return Response.json({ error: "The selected form is not published" }, { status: 503 });
  const locales = formDefinition.locales as Record<string, Record<string, unknown>> | undefined;
  const definition = locales?.[body.locale];
  const configuredFields = Array.isArray(definition?.fields) ? definition.fields.slice(0, 50) as Array<Record<string, unknown>> : [];
  const allowedFields = new Map(configuredFields.filter((field) => typeof field.name === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(field.name)).map((field) => [field.name as string, field]));
  if (!allowedFields.size) return Response.json({ error: "The selected form has no configured fields" }, { status: 503 });
  if ([...allowedFields.values()].some((field) => field.type === "select" && (!Array.isArray(field.options) || field.options.length === 0))) {
    return Response.json({ error: "The selected form has an unconfigured choice field" }, { status: 503 });
  }
  const missingRequired = [...allowedFields.entries()].some(([name, field]) => field.required === true && !body.fields[name]?.trim());
  if (missingRequired) return Response.json({ error: "Please complete all required fields" }, { status: 400 });
  const fields = Object.fromEntries(Object.entries(body.fields).filter(([key, value]) => allowedFields.has(key) && value.trim()));
  if (!Object.keys(fields).length) return Response.json({ error: "Please add contact details" }, { status: 400 });
  const invalidEmail = [...allowedFields.entries()].some(([name, field]) => field.type === "email" && fields[name] && !z.string().email().safeParse(fields[name]).success);
  if (invalidEmail) return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  const invalidChoice = [...allowedFields.entries()].some(([name, field]) => {
    if (field.type !== "select" || !fields[name]) return false;
    const options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string") : [];
    return !options.includes(fields[name]);
  });
  if (invalidChoice) return Response.json({ error: "Choose one of the available options" }, { status: 400 });
  if (!body.privacyConsent) return Response.json({ error: "Privacy consent is required" }, { status: 400 });

  try {
    const bucket = body.formType === "employer_inquiry" ? "employer_inquiries" : body.formType === "contact_inquiry" ? "contact_inquiries" : "applications";
    const db = getAdminDb();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = createHash("sha256").update(`${process.env.FIREBASE_RATE_LIMIT_SECRET}:${ip}`).digest("hex");
    const limiter = db.collection("submission_limits").doc(key);
    const allowed = await db.runTransaction(async (transaction) => {
      const record = await transaction.get(limiter);
      const current = record.data();
      const now = Date.now();
      if (current && current.windowEndsAt?.toMillis?.() > now && current.count >= 6) return false;
      const reset = !current || current.windowEndsAt?.toMillis?.() <= now;
      transaction.set(limiter, {
        count: reset ? 1 : (current?.count ?? 0) + 1,
        windowEndsAt: reset ? new Date(now + 60 * 60 * 1000) : current?.windowEndsAt,
      });
      return true;
    });
    if (!allowed) return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });

    await db.collection(bucket).add({
      type: body.formType,
      locale: body.locale,
      fields,
      privacyConsent: true,
      privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION || "pending-approval",
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Application submission storage failed", error);
    return Response.json({ error: "The submission could not be saved right now. Please try again later." }, { status: 503 });
  }
}
