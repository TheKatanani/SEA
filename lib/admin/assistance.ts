import { textHash, type TextPair } from "./content";

export type ContentSuggestion = { key: string; text: string; sourceHash: string; sourceText: string };

export function suggestionIsCurrent(suggestion: ContentSuggestion, pairs: TextPair[]) {
  return pairs.some(pair => pair.key === suggestion.key && pair.source === suggestion.sourceText && textHash(pair.source) === suggestion.sourceHash);
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
