// Read search/hash at click time: section and record selection can change through history.replaceState.
export function adminLanguageHref(search: string, hash = "") {
  const query = new URLSearchParams(search).toString();
  return "/admin" + (query ? "?" + query : "") + (hash ? hash.startsWith("#") ? hash : "#" + hash : "");
}
