import { parseArtifactIds } from './parse-artifact-ids';

describe('parseArtifactIds', () => {
  it('accepts empty input', () => {
    expect(parseArtifactIds(undefined)).toEqual({ ok: true, ids: [] });
    expect(parseArtifactIds('')).toEqual({ ok: true, ids: [] });
  });

  it('parses comma-separated strings', () => {
    expect(parseArtifactIds('art:1, art:2')).toEqual({ ok: true, ids: ['art:1', 'art:2'] });
  });

  it('parses JSON arrays', () => {
    expect(parseArtifactIds('["art:1","art:2"]')).toEqual({ ok: true, ids: ['art:1', 'art:2'] });
  });

  it('rejects invalid JSON arrays', () => {
    expect(parseArtifactIds('[invalid')).toEqual({
      ok: false,
      error: 'attachments must be a comma-separated list of artifact IDs or a JSON array of strings.',
    });
  });
});

