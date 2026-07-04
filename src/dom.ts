// Typed element lookup. Throws early if an expected id is missing, so a renamed
// element surfaces at startup rather than as a silent no-op later.
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}
