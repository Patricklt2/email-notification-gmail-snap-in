/**
 * Fetch DevRev artifact metadata and bytes for Gmail attachments.
 */

import { client } from '@devrev/typescript-sdk';
import axios, { type AxiosError, type AxiosResponse, isAxiosError } from 'axios';

import type { GmailSnapInLogger } from '../lib/gmail-logger';

// Gmail message size limits are ~25MB; we enforce 25MB total in higher-level logic.
// These HTTP limits provide an extra safety net against unexpected large responses.
const HTTP_TIMEOUT_MS = 30_000;
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;

/** Response shape from GET /internal/artifacts.get */
interface ArtifactsGetResponse {
  artifact?: {
    file?: {
      name?: string;
      size?: number;
      type?: string;
    };
  };
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/$/, '');
}

function logAxiosArtifactError(
  logger: GmailSnapInLogger | undefined,
  label: string,
  artifactId: string,
  err: unknown
): void {
  if (!logger || !isAxiosError(err)) {
    return;
  }
  const ax = err as AxiosError<unknown>;
  const status = ax.response?.status;
  const body = ax.response?.data;
  let bodyStr: string | undefined;
  if (body !== undefined && body !== null) {
    bodyStr = typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500);
  }
  logger.warn(`${label} failed:`, { artifactId, message: ax.message, responseBody: bodyStr, status });
}

/**
 * Returns file name, size, and MIME type from artifacts.get (no download).
 */
export async function getArtifactMetadata(
  endpoint: string,
  token: string,
  artifactId: string,
  logger?: GmailSnapInLogger
): Promise<{ contentType: string; name: string; size: number }> {
  const base = `${normalizeEndpoint(endpoint)}/internal/artifacts.get`;
  let data: ArtifactsGetResponse | undefined;
  try {
    const res = await axios.get<ArtifactsGetResponse, AxiosResponse<ArtifactsGetResponse>>(base, {
      headers: { Authorization: token },
      params: { id: artifactId },
      timeout: HTTP_TIMEOUT_MS,
    });
    data = res.data;
  } catch (err) {
    logAxiosArtifactError(logger, 'artifacts.get', artifactId, err);
    throw err;
  }

  const file = data?.artifact?.file;
  if (!data?.artifact) {
    throw new Error(`Artifact not found: ${artifactId}`);
  }
  const name = (file?.name as string | undefined) || 'attachment';
  const size = typeof file?.size === 'number' ? file.size : Number(file?.size) || 0;
  const contentType = (file?.type as string | undefined) || 'application/octet-stream';
  return { contentType, name, size };
}

/**
 * Downloads artifact bytes via locate URL.
 */
export async function downloadArtifactBytes(
  endpoint: string,
  token: string,
  artifactId: string,
  logger?: GmailSnapInLogger
): Promise<Buffer> {
  const normalized = normalizeEndpoint(endpoint);
  let artifactUrl: string | undefined;
  try {
    const devrevSDK = client.setup({ endpoint: normalized, token });
    const locateArtifactResponse = await devrevSDK.artifactsLocate({ id: artifactId });
    artifactUrl = locateArtifactResponse.data.url;
  } catch (err) {
    logAxiosArtifactError(logger, 'artifactsLocate', artifactId, err);
    throw err;
  }

  if (!artifactUrl) {
    throw new Error(`Could not locate download URL for artifact: ${artifactId}`);
  }

  let response;
  try {
    response = await axios.get(artifactUrl, {
      maxBodyLength: MAX_DOWNLOAD_BYTES,
      maxContentLength: MAX_DOWNLOAD_BYTES,
      responseType: 'arraybuffer',
      timeout: HTTP_TIMEOUT_MS,
    });
  } catch (err) {
    logAxiosArtifactError(logger, 'artifact download GET', artifactId, err);
    throw err;
  }

  return Buffer.from(response.data as ArrayBuffer);
}
