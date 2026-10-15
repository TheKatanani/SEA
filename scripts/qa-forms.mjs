import nextEnv from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

nextEnv.loadEnvConfig(process.cwd());

const baseUrl = (process.env.QA_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const target = new URL(baseUrl);
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
if (!isLocal && process.env.ALLOW_REMOTE_QA_SUBMISSIONS !== "true") {
  throw new Error("Form QA is restricted to localhost. Set ALLOW_REMOTE_QA_SUBMISSIONS=true only for an explicitly approved remote test.");
}

if (process.env.APPLICATIONS_ENABLED !== "true") throw new Error("APPLICATIONS_ENABLED must be true to test real form submissions.");
if (!process.env.FIREBASE_RATE_LIMIT_SECRET) throw new Error("FIREBASE_RATE_LIMIT_SECRET is required to verify and clean up the test rate-limit records.");

function credentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) return {
    project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
  throw new Error("Firebase Admin credentials are required for safe test cleanup.");
}

const app = getApps()[0] || initializeApp({ credential: cert(credentials()), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore(app);
const runId = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const limitIds = [];
const testEmails = [];
const requiredTypes = ["application_interest", "contact_inquiry", "employer_inquiry", "future_diploma_interest", "quick_interest"];
const bucketFor = (type) => type === "employer_inquiry" ? "employer_inquiries" : type === "contact_inquiry" ? "contact_inquiries" : "applications";

async function requestForm(body, index, headers = {}) {
  const ip = `codex-qa-${runId}-${index}`;
  if (!limitIds.includes(ip)) limitIds.push(ip);
  return fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: target.origin,
      "x-forwarded-host": target.host,
      "x-forwarded-for": ip,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function cleanup() {
  const failures = [];
  for (const { bucket, email, formType } of testEmails) {
    try {
      const matches = await db.collection(bucket).where("fields.email", "==", email).get();
      const batch = db.batch();
      let count = 0;
      for (const document of matches.docs) {
        if (document.data().type !== formType || !String(document.data().fields?.email || "").startsWith(`codex-qa-${runId}-`)) continue;
        batch.delete(document.ref);
        count += 1;
      }
      if (count) await batch.commit();
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "submission cleanup failed");
    }
  }
  for (const ip of limitIds) {
    try {
      const id = createHash("sha256").update(`${process.env.FIREBASE_RATE_LIMIT_SECRET}:${ip}`).digest("hex");
      await db.collection("submission_limits").doc(id).delete();
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "rate-limit cleanup failed");
    }
  }
  if (failures.length) throw new Error(`QA cleanup failed for ${failures.length} item(s): ${failures.join("; ")}`);
}

let successfulSubmissions = 0;
let rejectedInvalidForms = 0;
let rejectedInvalidChoices = 0;
try {
  const definitionsResponse = await fetch(`${baseUrl}/api/site/content?collection=forms`, { cache: "no-store" });
  if (!definitionsResponse.ok) throw new Error(`Could not load form definitions (HTTP ${definitionsResponse.status}).`);
  const definitions = await definitionsResponse.json();
  const forms = Array.isArray(definitions.items) ? definitions.items : [];
  const byType = new Map(forms.map((form) => [form.id, form]));
  for (const type of requiredTypes) {
    const form = byType.get(type);
    if (!form || form.status !== "published") throw new Error(`The ${type} form is not published.`);
    for (const locale of ["ar", "en"]) {
      const definition = form.locales?.[locale];
      if (!definition || !Array.isArray(definition.fields) || !definition.fields.length) throw new Error(`The ${type} form has no ${locale} fields.`);
      const brokenChoice = definition.fields.find((field) => field.type === "select" && (!Array.isArray(field.options) || !field.options.length));
      if (brokenChoice) throw new Error(`The ${type}/${locale} field "${brokenChoice.name}" has no options.`);

      const invalidResponse = await requestForm({ formType: type, locale, fields: {}, privacyConsent: true }, 1 + requiredTypes.indexOf(type) * 2 + (locale === "en" ? 1 : 0));
      if (invalidResponse.status !== 400) throw new Error(`${type}/${locale}: an empty form should be rejected with HTTP 400, received ${invalidResponse.status}.`);
      rejectedInvalidForms += 1;

      const selectField = definition.fields.find((field) => field.type === "select");
      if (type === "application_interest" && selectField) {
        const invalidEmail = `codex-qa-${runId}-invalid-choice-${locale}@example.invalid`;
        const invalidFields = Object.fromEntries(definition.fields.map((field) => {
          const value = field.name === "email" ? invalidEmail
            : field.type === "email" ? invalidEmail
              : field.type === "tel" ? "+966500000000"
                : field.type === "select" ? field.options[0]
                  : field.type === "textarea" ? "Automated QA validation only."
                    : `QA ${field.name}`;
          return [field.name, value];
        }));
        invalidFields[selectField.name] = "not-a-configured-option";
        const choiceResponse = await requestForm({ formType: type, locale, fields: invalidFields, privacyConsent: true }, 240 + (locale === "en" ? 1 : 0));
        if (choiceResponse.status !== 400) throw new Error(`${type}/${locale}: invalid select options should be rejected with HTTP 400, received ${choiceResponse.status}.`);
        rejectedInvalidChoices += 1;
      }

      const email = `codex-qa-${runId}-${type}-${locale}@example.invalid`;
      testEmails.push({ bucket: bucketFor(type), email, formType: type });
      const fields = Object.fromEntries(definition.fields.map((field) => {
        const value = field.type === "email" ? email
          : field.type === "tel" ? "+966500000000"
            : field.type === "select" ? field.options[0]
              : field.type === "textarea" ? "Automated QA submission only. Please ignore."
                : `QA ${field.name}`;
        return [field.name, value];
      }));
      const response = await requestForm({ formType: type, locale, fields, privacyConsent: true }, 1 + requiredTypes.indexOf(type) * 2 + (locale === "en" ? 1 : 0));
      const result = await response.json().catch(() => ({}));
      if (response.status !== 201 || result.ok !== true) throw new Error(`${type}/${locale}: valid test submission failed with HTTP ${response.status}.`);
      successfulSubmissions += 1;
    }
  }

  const badOrigin = await requestForm({ formType: "contact_inquiry", locale: "ar", fields: {}, privacyConsent: true }, 250, { "x-forwarded-host": "invalid.example" });
  if (badOrigin.status !== 403) throw new Error(`Origin protection should return HTTP 403, received ${badOrigin.status}.`);
} finally {
  await cleanup();
}

console.log(`Passed: ${successfulSubmissions} valid test submissions across ${requiredTypes.length} forms and both locales.`);
console.log(`Passed: ${rejectedInvalidForms} incomplete submissions rejected and invalid origin blocked.`);
console.log(`Passed: ${rejectedInvalidChoices} invalid program choices were rejected.`);
console.log("Cleanup: every synthetic Firestore submission and associated test rate-limit record was removed.");
