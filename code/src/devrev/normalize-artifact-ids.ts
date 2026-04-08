/**
 * Coerces workflow operation `artifact_ids` into a string array (array, JSON array string, or single id).
 * Supports typed workflow values such as `{ id: "don:..." }`.
 */
function coerceToArtifactIdString(x: unknown): string | null {
  if (x === undefined || x === null) {
    return null;
  }
  if (typeof x === 'string') {
    const t = x.trim();
    return t || null;
  }
  if (typeof x === 'object' && x !== null && 'id' in x) {
    const idVal = (x as { id?: unknown }).id;
    if (typeof idVal === 'string') {
      const t = idVal.trim();
      return t || null;
    }
  }
  const s = String(x).trim();
  if (!s || s === '[object Object]') {
    return null;
  }
  return s;
}

export function normalizeArtifactIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map(coerceToArtifactIdString).filter((s): s is string => s !== null);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(coerceToArtifactIdString).filter((s): s is string => s !== null);
      }
    } catch {
      /* single id */
    }
    const one = coerceToArtifactIdString(trimmed);
    return one ? [one] : [];
  }
  if (typeof raw === 'object') {
    const one = coerceToArtifactIdString(raw);
    return one ? [one] : [];
  }
  const one = coerceToArtifactIdString(raw);
  return one ? [one] : [];
}

