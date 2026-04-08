/**
 * Resolves the Gmail OAuth keyring secret string from various DevRev payload shapes.
 */

import type { FunctionInput } from '@devrev/typescript-sdk/dist/snap-ins';

import type { GmailSnapInLogger } from '../lib/gmail-logger';

export function secretFromKeyringObject(keyring: unknown): string | undefined {
  if (!keyring || typeof keyring !== 'object' || Array.isArray(keyring)) {
    return undefined;
  }
  const candidate = (keyring as { secret?: unknown }).secret;
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
}

export function secretFromKeyringsMap(keyrings: Record<string, unknown>): string | undefined {
  const slot = keyrings['gmail_oauth'];
  const fromObject = secretFromKeyringObject(slot);
  if (fromObject) {
    return fromObject;
  }
  if (typeof slot === 'string' && slot.trim()) {
    return slot.trim();
  }
  for (const [slotName, value] of Object.entries(keyrings)) {
    if (slotName !== 'gmail_oauth' && !slotName.includes('gmail_oauth')) {
      continue;
    }
    const resolved = secretFromKeyringObject(value) ?? (typeof value === 'string' ? value : undefined);
    if (resolved?.trim()) {
      return resolved.trim();
    }
  }
  for (const [, value] of Object.entries(keyrings)) {
    const typeId = String((value as { type_id?: string }).type_id ?? '');
    if (typeId.includes('gmail') || typeId.includes('gmail-oauth')) {
      const resolved = secretFromKeyringObject(value);
      if (resolved) {
        return resolved;
      }
    }
  }
  return undefined;
}

export function resolveGmailOAuthKeyringSecret(event: FunctionInput, logger?: GmailSnapInLogger): string | undefined {
  const resources = event.input_data?.resources as Record<string, unknown> | undefined;
  const resKeyrings = resources?.['keyrings'] as Record<string, unknown> | undefined;
  const fromResources = secretFromKeyringObject(resKeyrings?.['gmail_oauth']);
  if (fromResources) {
    return fromResources;
  }

  const inputData = event.input_data as Record<string, unknown> | undefined;
  const topKeyrings = inputData?.['keyrings'] as Record<string, unknown> | undefined;
  if (!topKeyrings || typeof topKeyrings !== 'object' || Array.isArray(topKeyrings)) {
    return undefined;
  }

  const gmailOAuth = topKeyrings['gmail_oauth'];
  const namedSecret = secretFromKeyringObject(gmailOAuth);
  if (namedSecret) {
    logger?.debug('resolved secret from input_data.keyrings.gmail_oauth.secret');
    return namedSecret;
  }
  if (typeof gmailOAuth === 'string' && gmailOAuth.trim()) {
    logger?.debug('resolved secret from input_data.keyrings.gmail_oauth (string payload)');
    return gmailOAuth.trim();
  }

  for (const [slotName, value] of Object.entries(topKeyrings)) {
    if (!slotName.includes('gmail_oauth') && slotName !== 'gmail_oauth') {
      continue;
    }
    const resolved = secretFromKeyringObject(value);
    if (resolved) {
      logger?.debug('resolved secret from input_data.keyrings.' + slotName);
      return resolved;
    }
  }

  for (const [slotName, value] of Object.entries(topKeyrings)) {
    const resolved = secretFromKeyringObject(value);
    if (!resolved) {
      continue;
    }
    const typeId = String((value as { type_id?: string }).type_id ?? '');
    if (typeId.includes('gmail') || typeId.includes('gmail-oauth')) {
      logger?.debug('resolved secret from input_data.keyrings.' + slotName, 'type_id=', typeId);
      return resolved;
    }
  }

  return undefined;
}
