export function parseArtifactIds(raw: string | undefined | null):
  | { ok: true; ids: string[] }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { ok: true, ids: [] };
  }

  const text = String(raw).trim();

  // Allow either:
  // - comma/whitespace-separated IDs: "art:1, art:2"
  // - JSON array of strings: ["art:1","art:2"]
  let ids: string[] = [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        return { ok: false, error: 'attachments must be a comma-separated list of artifact IDs or a JSON array of strings.' };
      }
      ids = parsed.map((v) => String(v));
    } catch {
      return { ok: false, error: 'attachments must be a comma-separated list of artifact IDs or a JSON array of strings.' };
    }
  } else {
    ids = text
      .split(/[,\n\r\t ]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const unique = Array.from(new Set(ids));
  if (unique.some((id) => !id.trim())) {
    return { ok: false, error: 'attachments contains an empty artifact id.' };
  }

  // Keep validation loose: allow "art:..." and DON forms.
  // Most errors will be caught by artifacts.locate.
  return { ok: true, ids: unique };
}

