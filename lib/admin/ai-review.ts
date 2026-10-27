import { z } from "zod";
import { allowedTextPath, textHash } from "./content";
export const reviewRequestSchema = z.object({ collection: z.string().max(40), fields: z.array(z.object({ key: z.string().max(150), ar: z.string().trim().min(1).max(12000), en: z.string().trim().min(1).max(12000) }).strict()).min(1).max(20) }).strict().superRefine((v, ctx) => {
  if (v.fields.some(f => !allowedTextPath(v.collection, f.key)) || new Set(v.fields.map(f => f.key)).size !== v.fields.length || v.fields.reduce((sum, f) => sum + f.ar.length + f.en.length, 0) > 12000) ctx.addIssue({ code: "custom", message: "Invalid review fields" });
});
export const reviewOutputSchema = z.object({ issues: z.array(z.object({ key: z.string().max(150), messageAr: z.string().trim().min(1).max(500), messageEn: z.string().trim().min(1).max(500) }).strict()).max(20) }).strict();
export function reviewHash(fields: z.infer<typeof reviewRequestSchema>["fields"]) { return textHash(JSON.stringify(fields)); }
