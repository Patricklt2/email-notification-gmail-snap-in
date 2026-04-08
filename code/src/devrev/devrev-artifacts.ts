import type { FunctionInput } from '@devrev/typescript-sdk/dist/snap-ins';

import type { GmailSnapInLogger } from '../lib/gmail-logger';
import type { ParsedAttachment } from '../gmail/parse-attachments';
import { downloadArtifactBytes, getArtifactMetadata } from './download-artifact';

const MAX_ATTACHMENTS = 10;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

function resolveBearerToken(event: FunctionInput): string | null {
  const secrets = event.context?.secrets as Record<string, unknown> | undefined;
  const token = (secrets?.['service_account_token'] || secrets?.['access_token']) as string | undefined;
  if (!token || !String(token).trim()) {
    return null;
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function parseFilenameFromContentDisposition(header: string | undefined): string | null {
  if (!header) return null;
  const m = /filename\*?=(?:UTF-8''|\"?)([^\";]+)\"?/i.exec(header);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, '_').trim();
  return base.length > 0 ? base.slice(0, 255) : 'attachment';
}

export async function resolveArtifactAttachments(
  event: FunctionInput,
  artifactIds: string[],
  logger: GmailSnapInLogger
): Promise<ParsedAttachment[]> {
  if (artifactIds.length === 0) return [];
  if (artifactIds.length > MAX_ATTACHMENTS) {
    throw new Error(`At most ${MAX_ATTACHMENTS} attachments are allowed.`);
  }

  const endpoint = event.execution_metadata?.devrev_endpoint?.replace(/\/$/, '') ?? '';
  const authHeader = resolveBearerToken(event);
  if (!endpoint || !authHeader) {
    throw new Error('DevRev endpoint and service account token are required to fetch artifact attachments.');
  }

  const attachments: ParsedAttachment[] = [];
  const token = authHeader.replace(/^Bearer /, '');

  const resolved: Array<{ contentType: string; id: string; name: string; size: number }> = [];
  let totalBytes = 0;
  for (const artifactId of artifactIds) {
    const meta = await getArtifactMetadata(endpoint, authHeader, artifactId, logger);
    if (meta.name.toLowerCase().endsWith('.eml')) {
      throw new Error(`Cannot attach .eml files (${meta.name}). This restriction prevents email loops.`);
    }
    totalBytes += meta.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(`Total attachment size exceeds ${MAX_TOTAL_BYTES / (1024 * 1024)} MB limit.`);
    }
    resolved.push({ contentType: meta.contentType, id: artifactId, name: meta.name, size: meta.size });
  }

  for (const item of resolved) {
    const buf = await downloadArtifactBytes(endpoint, token, item.id, logger);
    if (buf.length === 0) {
      throw new Error(`Artifact is empty: ${item.id}`);
    }
    attachments.push({
      contentBase64: buf.toString('base64'),
      contentType: item.contentType || 'application/octet-stream',
      filename: sanitizeFilename(item.name || `${item.id}`),
    });
  }

  return attachments;
}

