import type { FunctionInput } from '@devrev/typescript-sdk/dist/snap-ins';

import { resolveArtifactAttachments } from './devrev-artifacts';

jest.mock('./download-artifact', () => ({
  downloadArtifactBytes: jest.fn(),
  getArtifactMetadata: jest.fn(),
}));

import { downloadArtifactBytes, getArtifactMetadata } from './download-artifact';

const mockedGetArtifactMetadata = getArtifactMetadata as unknown as jest.Mock;
const mockedDownloadArtifactBytes = downloadArtifactBytes as unknown as jest.Mock;


function makeEvent(): FunctionInput {
  return {
    context: { secrets: { service_account_token: 'token' } },
    execution_metadata: { devrev_endpoint: 'https://api.devrev.ai' },
  } as unknown as FunctionInput;
}


describe('resolveArtifactAttachments', () => {
  beforeEach(() => {
    mockedGetArtifactMetadata.mockReset();
    mockedDownloadArtifactBytes.mockReset();
  });

  it('returns empty array when no ids provided', async () => {
    const out = await resolveArtifactAttachments(makeEvent(), [], console as any);
    expect(out).toEqual([]);
  });

  it('blocks .eml attachments', async () => {
    mockedGetArtifactMetadata.mockResolvedValueOnce({
      contentType: 'message/rfc822',
      name: 'loop.eml',
      size: 10,
    });

    await expect(resolveArtifactAttachments(makeEvent(), ['art:1'], console as any)).rejects.toThrow(/\.eml/i);
  });

  it('fails when an artifact downloads as empty', async () => {
    mockedGetArtifactMetadata.mockResolvedValueOnce({
      contentType: 'application/pdf',
      name: 'a.pdf',
      size: 10,
    });
    mockedDownloadArtifactBytes.mockResolvedValueOnce(Buffer.alloc(0));

    await expect(resolveArtifactAttachments(makeEvent(), ['art:1'], console as any)).rejects.toThrow(/empty/i);
  });

  it('sanitizes filenames to prevent path traversal', async () => {
    mockedGetArtifactMetadata.mockResolvedValueOnce({
      contentType: 'image/png',
      name: '../a.png',
      size: 10,
    });
    mockedDownloadArtifactBytes.mockResolvedValueOnce(Buffer.from('abc', 'utf8'));

    const out = await resolveArtifactAttachments(makeEvent(), ['art:1'], console as any);
    expect(out[0]?.filename).toBe('.._a.png');
  });

  it('enforces max attachments count', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `art:${i + 1}`);
    await expect(resolveArtifactAttachments(makeEvent(), ids, console as any)).rejects.toThrow(/At most 10/);
  });
});

