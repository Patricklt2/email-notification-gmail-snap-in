/**
 * Deep-redact sensitive keys for safe logging.
 * Set GMAIL_EMAIL_LOG_RAW_EVENT=1 locally to print the unredacted event (never in shared logs).
 */

import { createGmailLogger } from '../../lib/gmail-logger';

const SENSITIVE_KEYS = new Set([
  'access_token',
  'actor_session_token',
  'client_secret',
  'password',
  'refresh_token',
  'secret',
  'service_account_token',
]);

const debugLogger = createGmailLogger('[gmail-email-debug]');

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 30) {
    return '[max-depth]';
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > 4000 ? `[string length=${value.length}]` : value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) {
      const len = typeof v === 'string' ? v.length : JSON.stringify(v ?? '').length;
      out[k] = `[REDACTED:${k}:length=${len}]`;
    } else {
      out[k] = redactDeep(v, depth + 1);
    }
  }
  return out;
}

export function logResourcesAndKeyringsDetail(event: unknown): void {
  const inputData = (event as { input_data?: Record<string, unknown> })?.input_data;
  debugLogger.debug('---------- input_data (top) ----------');
  if (!inputData || typeof inputData !== 'object') {
    debugLogger.debug('input_data: missing or not an object', inputData);
    return;
  }
  debugLogger.debug('input_data keys:', Object.keys(inputData));

  const resources = inputData['resources'];
  debugLogger.debug('---------- input_data.resources ----------');
  if (resources === undefined || resources === null) {
    debugLogger.debug('resources: null/undefined');
    return;
  }
  if (typeof resources !== 'object' || Array.isArray(resources)) {
    debugLogger.debug('resources: unexpected type', typeof resources, resources);
    return;
  }

  const resObj = resources as Record<string, unknown>;
  debugLogger.debug('resources keys:', Object.keys(resObj));

  const keyrings = resObj['keyrings'];
  debugLogger.debug('---------- resources.keyrings ----------');
  if (!keyrings || typeof keyrings !== 'object' || Array.isArray(keyrings)) {
    debugLogger.debug('resources.keyrings: empty or not an object', keyrings);
  } else {
    const slots = Object.keys(keyrings as object);
    debugLogger.debug('keyrings slot names:', slots.length ? slots.join(', ') : '(none)');
    for (const slotName of slots) {
      const kr = (keyrings as Record<string, unknown>)[slotName];
      if (!kr || typeof kr !== 'object' || Array.isArray(kr)) {
        debugLogger.debug(`keyrings.${slotName}:`, typeof kr, kr);
        continue;
      }
      const k = kr as Record<string, unknown>;
      const sec = k['secret'];
      debugLogger.debug(`keyrings.${slotName}:`, {
        hasSecret: sec !== undefined && sec !== null && sec !== '',
        objectKeys: Object.keys(k),
        secretLength: typeof sec === 'string' ? sec.length : 'n/a',
        secretType: typeof sec,
        type_id: k['type_id'],
      });
    }
  }
  debugLogger.debug('---------- end resources/keyrings detail ----------');
}

export function logFullIncomingEvent(event: unknown, eventsLength: number): void {
  debugLogger.debug('========== INCOMING EVENT (summary) ==========');
  debugLogger.debug('events.length:', eventsLength);
  debugLogger.debug(
    'GMAIL_EMAIL_LOG_RAW_EVENT=',
    process.env['GMAIL_EMAIL_LOG_RAW_EVENT'] || '(unset, using redacted log)'
  );

  try {
    const redacted = redactDeep(event);
    debugLogger.debug('full event (secrets/tokens redacted):\n', JSON.stringify(redacted, null, 2));
  } catch (e) {
    debugLogger.debug('failed to stringify redacted event:', e);
  }

  if (process.env['GMAIL_EMAIL_LOG_RAW_EVENT'] === '1' || process.env['GMAIL_EMAIL_LOG_RAW_EVENT'] === 'true') {
    console.warn('[gmail-email-debug]', 'RAW EVENT LOG ENABLED — contains secrets; use only on localhost');
    try {
      console.log('[gmail-email-debug]', 'RAW event:\n', JSON.stringify(event, null, 2));
    } catch (e) {
      console.log('[gmail-email-debug]', 'failed to stringify raw event (circular?):', e);
    }
  }

  logResourcesAndKeyringsDetail(event);
  debugLogger.debug('========== END INCOMING EVENT ==========');
}
