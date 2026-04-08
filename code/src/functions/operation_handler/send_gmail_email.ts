/**
 * Workflow operation: send email via Gmail API using OAuth2 keyring credentials.
 */

import {
  ExecuteOperationInput,
  FunctionInput,
  OperationBase,
  OperationContext,
  OperationOutput,
  OutputValue,
} from '@devrev/typescript-sdk/dist/snap-ins';

import {
  parseEmailRecipient,
  recipientLinesToValidatedAddresses,
  splitRecipientList,
} from '../../gmail/email-recipients';
import { resolveGmailOAuthKeyringSecret, secretFromKeyringsMap } from '../../gmail/gmail-keyring';
import { sendGmailMessage } from '../../gmail/gmail-mail-client';
import { parseGmailOAuthKeyringSecretJson } from '../../gmail/gmail-oauth-credentials';
import { logKeyringDiagnostics } from '../../gmail/keyring-debug-logs';
import { fetchSnapInResources } from '../../gmail/snap-in-resources-client';
import { resolveArtifactAttachments } from '../../devrev/devrev-artifacts';
import { normalizeArtifactIds } from '../../devrev/normalize-artifact-ids';
import { createGmailLogger } from '../../lib/gmail-logger';

export { resolveGmailOAuthKeyringSecret } from '../../gmail/gmail-keyring';

export class SendGmailEmailOp extends OperationBase {
  private readonly snapEvent: FunctionInput;

  private readonly logger = createGmailLogger();

  public constructor(event: FunctionInput) {
    super(event);
    this.snapEvent = event;
  }

  /**
   * Builds a consistent "failure" output payload. This keeps error handling uniform across
   * validation failures and unexpected exceptions.
   */
  private fail(message: string): OperationOutput {
    this.logger.warn('FAIL:', message);
    return OperationOutput.fromJSON({
      output: {
        values: [{ error_message: message, success: false }],
      } as OutputValue,
    });
  }

  /**
   * Converts workflow input value into a non-empty trimmed string or returns a user-facing error.
   */
  private requireNonEmptyText(fieldLabel: string, value: unknown): string | { error: string } {
    const text = value === undefined || value === null ? '' : String(value);
    if (!text.trim()) {
      return { error: `${fieldLabel} is required.` };
    }
    return text;
  }

  /**
   * Prevents header injection (CRLF) in fields that become RFC 2822 headers.
   */
  private rejectCrlf(label: string, value: string): { ok: true } | { ok: false; error: string } {
    if (value.includes('\r') || value.includes('\n')) {
      return { ok: false, error: `${label} must not contain newlines.` };
    }
    return { ok: true };
  }

  private resolveBodyFormat(raw: unknown): 'html' | 'plain' {
    const normalized = String(raw ?? 'html').toLowerCase();
    return normalized === 'plain' ? 'plain' : 'html';
  }

  /**
   * Resolves the Gmail OAuth keyring secret from the event itself and (as fallback) from the
   * Snap-in resources API.
   */
  private async resolveKeyringSecretJson(): Promise<string | undefined> {
    let keyringSecretJson = resolveGmailOAuthKeyringSecret(this.snapEvent, this.logger);
    if (keyringSecretJson) {
      return keyringSecretJson;
    }

    const snap = await fetchSnapInResources(this.snapEvent, this.logger);
    if (snap?.keyrings && Object.keys(snap.keyrings).length > 0) {
      keyringSecretJson = secretFromKeyringsMap(snap.keyrings);
    }
    return keyringSecretJson;
  }

  private parseRecipientsOrFail(params: Record<string, unknown>): { ok: true; to: string[]; cc: string[]; bcc: string[] } | { ok: false; error: string } {
    try {
      const toLines = splitRecipientList(params['to'] as string | undefined);
      const ccLines = splitRecipientList(params['cc'] as string | undefined);
      const bccLines = splitRecipientList(params['bcc'] as string | undefined);

      // Basic CRLF protection before values are placed into message headers.
      const allLines = [...toLines, ...ccLines, ...bccLines];
      if (allLines.some((l) => l.includes('\r') || l.includes('\n'))) {
        return { ok: false, error: 'Recipient fields must not contain newlines.' };
      }

      const toAddresses = recipientLinesToValidatedAddresses(toLines);
      const ccAddresses = recipientLinesToValidatedAddresses(ccLines);
      const bccAddresses = recipientLinesToValidatedAddresses(bccLines);
      return { ok: true, bcc: bccAddresses, cc: ccAddresses, to: toAddresses };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public async run(_context: OperationContext, input: ExecuteOperationInput): Promise<OperationOutput> {
    const params = (input.data || {}) as Record<string, unknown>;
    const bodyFormat = this.resolveBodyFormat(params['body_format']);

    try {
      logKeyringDiagnostics(this.snapEvent, this.logger);

      const toLineRequired = this.requireNonEmptyText('To', params['to']);
      if (typeof toLineRequired !== 'string') return this.fail(toLineRequired.error);

      const subjectRequired = this.requireNonEmptyText('Subject', params['subject']);
      if (typeof subjectRequired !== 'string') return this.fail(subjectRequired.error);
      const subjectCrlf = this.rejectCrlf('Subject', subjectRequired);
      if (!subjectCrlf.ok) return this.fail(subjectCrlf.error);

      const bodyRequired = this.requireNonEmptyText('Body', params['body']);
      if (typeof bodyRequired !== 'string') return this.fail(bodyRequired.error);

      const artifactIds = [...new Set(normalizeArtifactIds(params['artifact_ids'] ?? params['attachments']))];
      this.logger.debug('attachment artifact_ids count:', artifactIds.length);

      const toSegments = splitRecipientList(toLineRequired).map(parseEmailRecipient);
      const invalidTo = toSegments.find((r) => !r.emailAddress.address);
      if (invalidTo) {
        return this.fail('One or more To addresses are invalid.');
      }

      const keyringSecretJson = await this.resolveKeyringSecretJson();
      if (!keyringSecretJson) {
        return this.fail(
          'Gmail OAuth keyring is not configured. Add Client ID, Secret, Redirect URI, and Refresh Token in snap-in settings.'
        );
      }

      const parsed = parseGmailOAuthKeyringSecretJson(keyringSecretJson);
      if ('errorMessage' in parsed) {
        return this.fail(parsed.errorMessage);
      }

      const recipients = this.parseRecipientsOrFail(params);
      if (!recipients.ok) return this.fail(recipients.error);

      if (recipients.to.length === 0) {
        return this.fail('At least one valid To address is required.');
      }

      let attachments: { readonly contentBase64: string; readonly contentType: string; readonly filename: string }[] = [];
      try {
        attachments = await resolveArtifactAttachments(this.snapEvent, artifactIds, this.logger);
      } catch (err) {
        return this.fail(err instanceof Error ? err.message : String(err));
      }

      await sendGmailMessage(
        parsed.credentials,
        {
          attachments,
          bccAddresses: recipients.bcc,
          body: bodyRequired,
          bodyFormat,
          ccAddresses: recipients.cc,
          subject: subjectRequired,
          toAddresses: recipients.to,
        },
        this.logger
      );

      return OperationOutput.fromJSON({
        output: {
          values: [{ error_message: '', success: true }],
        } as OutputValue,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('SendGmailEmailOp error:', error);
      return this.fail(message);
    }
  }
}
