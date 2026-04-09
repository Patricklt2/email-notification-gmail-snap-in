import { normalizeArtifactIds } from './normalize-artifact-ids';

describe('normalizeArtifactIds', () => {
  it('returns empty array for empty values', () => {
    expect(normalizeArtifactIds(undefined)).toEqual([]);
    expect(normalizeArtifactIds(null)).toEqual([]);
    expect(normalizeArtifactIds('   ')).toEqual([]);
  });

  it('accepts an array of strings and objects with id', () => {
    expect(normalizeArtifactIds(['art:1', { id: 'art:2' }, { id: '  ' }])).toEqual(['art:1', 'art:2']);
  });

  it('accepts JSON array strings', () => {
    expect(normalizeArtifactIds('["art:1","art:2"]')).toEqual(['art:1', 'art:2']);
  });

  it('treats non-JSON strings as a single id', () => {
    expect(normalizeArtifactIds('art:1, art:2')).toEqual(['art:1, art:2']);
  });
});
