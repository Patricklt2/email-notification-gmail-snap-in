/**
 * Gmail API send via direct HTTP (OAuth2 refresh token).
 */

import axios from 'axios';
import { randomBytes } from 'crypto';

import type { GmailSnapInLogger } from '../lib/gmail-logger';
import type { GmailOAuthCredentials } from './gmail-oauth-credentials';
import type { ParsedAttachment } from './parse-attachments';

export type GmailBodyFormat = 'html' | 'plain';

/**
 * RFC 2045 suggests base64 line length of 76 characters.
 * Gmail accepts long lines, but folding improves interoperability.
 */
function foldBase64(b64: string): string {
  const cleaned = b64.replace(/\s+/g, '');
  const lines: string[] = [];
  for (let i = 0; i < cleaned.length; i += 76) {
    lines.push(cleaned.slice(i, i + 76));
  }
  return lines.join('\r\n');
}

export type GmailSendParams = {
  readonly attachments: ParsedAttachment[];
  readonly bccAddresses: string[];
  readonly body: string;
  readonly bodyFormat: GmailBodyFormat;
  readonly ccAddresses: string[];
  readonly subject: string;
  readonly toAddresses: string[];
};

function buildMultipartMixedMessage(params: GmailSendParams): string {
  const boundary = `----=_Part_${Date.now()}_${randomBytes(8).toString('hex')}`;
  const innerContentType = params.bodyFormat === 'plain' ? 'text/plain; charset=UTF-8' : 'text/html; charset=UTF-8';
  const bodyB64 = Buffer.from(params.body, 'utf8').toString('base64');

  const headerBlock = [
    `To: ${params.toAddresses.join(', ')}`,
    ...(params.ccAddresses.length > 0 ? [`Cc: ${params.ccAddresses.join(', ')}`] : []),
    ...(params.bccAddresses.length > 0 ? [`Bcc: ${params.bccAddresses.join(', ')}`] : []),
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const parts: string[] = [];
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: ${innerContentType}`);
  parts.push('Content-Transfer-Encoding: base64');
  parts.push('');
  parts.push(foldBase64(bodyB64));

  for (const att of params.attachments) {
    const safeName = att.filename.replace(/"/g, '_');
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${att.contentType}; name="${safeName}"`);
    parts.push(`Content-Disposition: attachment; filename="${safeName}"`);
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('');
    parts.push(foldBase64(att.contentBase64));
  }

  parts.push(`--${boundary}--`);

  return `${headerBlock.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

function buildSimpleMessage(params: GmailSendParams): string {
  const contentType = params.bodyFormat === 'plain' ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8';
  const headerLines = [
    `To: ${params.toAddresses.join(', ')}`,
    ...(params.ccAddresses.length > 0 ? [`Cc: ${params.ccAddresses.join(', ')}`] : []),
    ...(params.bccAddresses.length > 0 ? [`Bcc: ${params.bccAddresses.join(', ')}`] : []),
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}`,
    `Subject: ${params.subject}`,
  ];
  return `${headerLines.join('\r\n')}\r\n\r\n${params.body}`;
}

async function refreshAccessToken(credentials: GmailOAuthCredentials, logger: GmailSnapInLogger): Promise<string> {
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    grant_type: 'refresh_token',
    // redirect_uri is not required for refresh-token grant, but we keep it for compatibility/debugging.
    redirect_uri: credentials.redirectUri,

    refresh_token: credentials.refreshToken,
  });

  const tokenRes = await axios.post('https://oauth2.googleapis.com/token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    maxBodyLength: 1024 * 1024,
    maxContentLength: 1024 * 1024,
    timeout: 30_000,
    validateStatus: () => true,
  });

  if (tokenRes.status < 200 || tokenRes.status >= 300) {
    const detail = typeof tokenRes.data === 'string' ? tokenRes.data : JSON.stringify(tokenRes.data);
    logger.error('OAuth token refresh failed:', tokenRes.status, detail);
    throw new Error(`OAuth token refresh failed with HTTP ${tokenRes.status}.`);
  }

  const accessToken =
    tokenRes.data && typeof tokenRes.data === 'object' && 'access_token' in (tokenRes.data as Record<string, unknown>)
      ? String((tokenRes.data as Record<string, unknown>)['access_token'] ?? '')
      : '';

  if (!accessToken) {
    logger.error('OAuth token refresh did not return access_token:', tokenRes.data);
    throw new Error('OAuth token refresh failed (missing access_token).');
  }

  return accessToken;
}

/**
 * Builds a raw RFC 2822 message payload (CRLF line endings), suitable for encoding and sending via Gmail API.
 * This is kept pure/deterministic (except for multipart boundary) so it can be unit tested.
 */
export function buildRawEmailMessage(params: GmailSendParams): string {
  if (params.attachments.length > 0) {
    return buildMultipartMixedMessage(params);
  }
  return buildSimpleMessage(params);
}

export async function sendGmailMessage(
  credentials: GmailOAuthCredentials,
  params: GmailSendParams,
  logger: GmailSnapInLogger
): Promise<{ readonly messageId: string }> {
  const raw = buildRawEmailMessage(params);

  const encodedMessage = Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const accessToken = await refreshAccessToken(credentials, logger);

  const result = await axios.post(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    { raw: encodedMessage },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      // Request can be large because `raw` contains a base64url-encoded RFC 2822 message,
      // including attachments. DevRev-side validation limits attachments to <= 25 MB total,
      // but base64 inflates size by ~33%, so allow enough headroom.
      maxBodyLength: 40 * 1024 * 1024,

      maxContentLength: 1024 * 1024,
      timeout: 30_000,
      validateStatus: () => true,
    }
  );

  if (result.status < 200 || result.status >= 300) {
    const detail = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    logger.error('Gmail send failed:', result.status, detail);
    throw new Error(`Gmail send failed with HTTP ${result.status}.`);
  }

  const messageId =
    result.data && typeof result.data === 'object' && 'id' in (result.data as Record<string, unknown>)
      ? String((result.data as Record<string, unknown>)['id'] ?? 'unknown')
      : 'unknown';
  logger.debug('Gmail send OK, message id:', messageId);
  return { messageId };
}
