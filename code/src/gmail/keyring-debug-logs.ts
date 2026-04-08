/**
 * Debug-only logging of keyring *shape* (never secret values).
 */

import type { FunctionInput } from '@devrev/typescript-sdk/dist/snap-ins';

import type { GmailSnapInLogger } from '../lib/gmail-logger';

export function logKeyringDiagnostics(event: FunctionInput, logger: GmailSnapInLogger): void {
  const resources = event.input_data?.resources as Record<string, unknown> | undefined;
  const keyrings = resources?.['keyrings'] as Record<string, unknown> | undefined;
  const inputDataTop = event.input_data as Record<string, unknown> | undefined;
  const rawTopKeyrings = inputDataTop?.['keyrings'];
  const naryKeyrings = resources?.['nary_keyrings'] as Record<string, unknown[]> | undefined;

  logger.debug('input_data.resources keys:', resources ? Object.keys(resources) : '(missing resources)');
  logger.debug('resources.keyrings keys:', keyrings ? Object.keys(keyrings) : '(missing or empty)');
  if (rawTopKeyrings === null) {
    logger.debug(
      'input_data.keyrings is null (JS typeof null === object — no keyring refs; try snap-ins.resources if snap_in_id set)'
    );
  } else if (rawTopKeyrings === undefined) {
    logger.debug('input_data.keyrings: undefined');
  } else if (Array.isArray(rawTopKeyrings)) {
    logger.debug('input_data.keyrings: array length=', rawTopKeyrings.length);
  } else if (typeof rawTopKeyrings === 'object') {
    logger.debug('input_data.keyrings keys:', Object.keys(rawTopKeyrings as object));
  } else {
    logger.debug('input_data.keyrings:', typeof rawTopKeyrings);
  }

  if (naryKeyrings && typeof naryKeyrings === 'object') {
    logger.debug('nary_keyrings keys:', Object.keys(naryKeyrings));
  }

  const gmailSlot = keyrings?.['gmail_oauth'] as Record<string, unknown> | undefined;
  logger.debug('keyrings.gmail_oauth exists:', !!gmailSlot);
  if (gmailSlot) {
    logger.debug('keyrings.gmail_oauth keys:', Object.keys(gmailSlot));
    const secretField = gmailSlot['secret'];
    logger.debug(
      'keyrings.gmail_oauth.secret: type=',
      typeof secretField,
      'length=',
      typeof secretField === 'string' ? secretField.length : 'n/a',
      'truthy=',
      !!secretField
    );
  }

  if (keyrings) {
    const matching = Object.keys(keyrings).filter((key) => key.includes('gmail'));
    if (matching.length > 0) {
      logger.debug('keyring keys containing gmail:', matching);
    }
  }
}
