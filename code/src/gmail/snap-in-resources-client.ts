/**
 * Fetches merged snap-in inputs/keyrings from DevRev when the runtime payload omits keyring material.
 */

import type { FunctionInput } from '@devrev/typescript-sdk/dist/snap-ins';
import axios from 'axios';

import type { GmailSnapInLogger } from '../lib/gmail-logger';

export type SnapInResourcesPayload = {
  readonly inputs?: Record<string, unknown>;
  readonly keyrings?: Record<string, unknown>;
};

export async function fetchSnapInResources(
  event: FunctionInput,
  logger: GmailSnapInLogger
): Promise<SnapInResourcesPayload | null> {
  const baseUrl = event.execution_metadata?.devrev_endpoint?.replace(/\/$/, '') ?? '';
  const secrets = event.context?.secrets as Record<string, string> | undefined;
  const bearerToken = secrets?.['service_account_token'] || secrets?.['access_token'];
  const snapInId = event.context?.snap_in_id;

  if (!baseUrl || !bearerToken || !String(snapInId ?? '').trim()) {
    logger.debug('snap-ins.resources skipped:', {
      hasEndpoint: !!baseUrl,
      hasToken: !!bearerToken,
      snap_in_id: snapInId || '(empty — testing-url workflows often omit this)',
    });
    return null;
  }

  const authorizationHeader = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  const candidatePaths = ['/internal/snap-ins.resources', '/snap-ins.resources'];

  for (const pathSuffix of candidatePaths) {
    try {
      const { data, status } = await axios.post(
        `${baseUrl}${pathSuffix}`,
        { id: snapInId },
        {
          headers: {
            Authorization: authorizationHeader,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
          validateStatus: () => true,
        }
      );
      if (status >= 400) {
        logger.debug('snap-ins.resources', pathSuffix, 'HTTP', status);
        continue;
      }
      const keyringKeys = data?.keyrings && typeof data.keyrings === 'object' ? Object.keys(data.keyrings) : [];
      logger.debug('snap-ins.resources OK', pathSuffix, 'keyring slots:', keyringKeys.join(', ') || '(none)');
      return {
        inputs: data?.inputs && typeof data.inputs === 'object' ? data.inputs : undefined,
        keyrings: data?.keyrings && typeof data.keyrings === 'object' ? data.keyrings : undefined,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug('snap-ins.resources error', pathSuffix, message);
    }
  }
  return null;
}
