import { allowedTextPath, buildTranslationState, getPath, localePath, textHash, textPairs, type ContentRecord, type Locale, type TextPair } from "./content";

export type ContentSuggestion = { key: string; text: string; sourceHash: string; sourceText: string; targetText?: string };

export function suggestionIsCurrent(suggestion: ContentSuggestion, pairs: TextPair[]) {
  return pairs.some(pair => pair.key === suggestion.key && pair.source === suggestion.sourceText && textHash(pair.source) === suggestion.sourceHash && (suggestion.targetText === undefined || pair.target === suggestion.targetText));
}

export function translationTasks(collection: string, value: ContentRecord, baseline?: ContentRecord, metadata = {}, reviewed: string[] = []) {
  const state = buildTranslationState(collection, value, baseline, metadata, reviewed);
  const tasks = new Map<string, { key: string; locale: Locale; reason: string }>();
  for (const locale of ["ar", "en"] as const) for (const pair of textPairs(collection, value, locale)) {
    const status = state[locale + ":" + pair.key]?.status;
    if (pair.source.trim() && (!pair.target.trim() || status === "outdated" || status === "suggested")) {
      if (!tasks.has(pair.key) || !pair.target.trim() || status === "outdated") tasks.set(pair.key, { key: pair.key, locale, reason: !pair.target.trim() ? "missing" : status || "suggested" });
    }
  }
  return [...tasks.values()];
}

export function assistanceBatch(pairs: TextPair[], keys: string[], action: string, brief = "") {
  let size = action === "draft" ? brief.length : 0;
  const fields: Array<{ key: string; text: string }> = [];
  for (const pair of pairs) {
    if (!keys.includes(pair.key) || !pair.source.trim() && action !== "draft") continue;
    if (fields.length === 20) break;
    if (size + pair.source.length > 12000) continue;
    size += pair.source.length;
    fields.push({ key: pair.key, text: pair.source });
  }
  return fields;
}

// Blank nested fields still need to support drafting before a value exists.
export function editableTextPairs(collection: string, record: ContentRecord, locale: Locale, keys: Iterable<string>): TextPair[] {
  const pairs = textPairs(collection, record, locale);
  for (const key of keys) if (allowedTextPath(collection, key) && !pairs.some(pair => pair.key === key)) pairs.push({ key, label: key, source: String(getPath(record, localePath(collection, locale, key)) ?? ""), target: String(getPath(record, localePath(collection, locale === "ar" ? "en" : "ar", key)) ?? "") });
  return pairs;
}
