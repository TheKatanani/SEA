const allowed = new Set([
  "id", "status", "locales", "ar", "en", "title", "titleAr", "titleEn", "name", "description", "descriptionAr", "descriptionEn",
  "slug", "href", "type", "category", "isDiploma", "featured", "source", "imageUrl", "image", "logoUrl", "url", "documentUrl", "thumbnailUrl",
  "resourceType", "format", "width", "height", "duration", "statusLabel", "sortOrder", "eventDate", "startDate", "endDate", "location", "price",
  "summary", "body", "question", "answer", "role", "group", "caption", "alt", "imageAlt", "sections", "heading", "collection", "recordId",
  "formType", "fields", "name", "label", "required", "options", "placeholder", "full", "buttonLabel", "buttonUrl",
  "requirements", "documents", "pillars", "outcomes", "careers", "targetAudience", "hoursAndSchedule", "seoTitle", "seoDescription",
]);
export function publicRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicRecord);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)).map(([key, item]) => [key, publicRecord(item)]));
  return value;
}

