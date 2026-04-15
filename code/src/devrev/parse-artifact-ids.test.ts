import { parseArtifactIds } from './parse-artifact-ids';

describe('parseArtifactIds', () => {
  it('accepts empty input', () => {
    expect(parseArtifactIds(undefined)).toEqual({ ids: [], ok: true });
    expect(parseArtifactIds('')).toEqual({ ids: [], ok: true });
  });

  it('parses comma-separated strings', () => {
    expect(parseArtifactIds('art:1, art:2')).toEqual({ ids: ['art:1', 'art:2'], ok: true });
  });

  it('parses JSON arrays', () => {
    expect(parseArtifactIds('["art:1","art:2"]')).toEqual({ ids: ['art:1', 'art:2'], ok: true });
  });

  it('rejects invalid JSON arrays', () => {
    expect(parseArtifactIds('[invalid')).toEqual({
      error: 'attachments must be a comma-separated list of artifact IDs or a JSON array of strings.',
      ok: false,
    });
  });
});
