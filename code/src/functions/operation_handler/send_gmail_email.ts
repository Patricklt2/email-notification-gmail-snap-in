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

import { resolveArtifactAttachments } from '../../devrev/devrev-artifacts';
import { normalizeArtifactIds } from '../../devrev/normalize-artifact-ids';
import {
  parseEmailRecipient,
  recipientLinesToValidatedAddresses,
  splitRecipientList,
} from '../../gmail/email-recipients';
import { sendGmailMessage } from '../../gmail/gmail-mail-client';
import { createGmailLogger } from '../../lib/gmail-logger';
import { LabsUsageTracker } from '../../lib/labs_usage';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../../package.json');

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
      return { error: `${label} must not contain newlines.`, ok: false };
    }
    return { ok: true };
  }

  private resolveBodyFormat(raw: unknown): 'html' | 'plain' {
    const normalized = String(raw ?? 'html').toLowerCase();
    return normalized === 'plain' ? 'plain' : 'html';
  }

  private parseRecipientsOrFail(
    params: Record<string, unknown>
  ): { ok: true; to: string[]; cc: string[]; bcc: string[] } | { ok: false; error: string } {
    try {
      const toLines = splitRecipientList(params['to'] as string | undefined);
      const ccLines = splitRecipientList(params['cc'] as string | undefined);
      const bccLines = splitRecipientList(params['bcc'] as string | undefined);

      // Basic CRLF protection before values are placed into message headers.
      const allLines = [...toLines, ...ccLines, ...bccLines];
      if (allLines.some((l) => l.includes('\r') || l.includes('\n'))) {
        return { error: 'Recipient fields must not contain newlines.', ok: false };
      }

      const toAddresses = recipientLinesToValidatedAddresses(toLines);
      const ccAddresses = recipientLinesToValidatedAddresses(ccLines);
      const bccAddresses = recipientLinesToValidatedAddresses(bccLines);
      return { bcc: bccAddresses, cc: ccAddresses, ok: true, to: toAddresses };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), ok: false };
    }
  }

  public async run(_context: OperationContext, input: ExecuteOperationInput): Promise<OperationOutput> {
    const params = (input.data || {}) as Record<string, unknown>;
    const bodyFormat = this.resolveBodyFormat(params['body_format']);

    try {
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

      const accessToken = this.snapEvent.input_data?.resources?.['keyrings']?.gmail_oauth?.secret as string | undefined;
      if (!accessToken) {
        return this.fail('Gmail OAuth connection is not configured. Connect a Gmail account in snap-in settings.');
      }

      const recipients = this.parseRecipientsOrFail(params);
      if (!recipients.ok) return this.fail(recipients.error);

      if (recipients.to.length === 0) {
        return this.fail('At least one valid To address is required.');
      }

      let attachments: { readonly contentBase64: string; readonly contentType: string; readonly filename: string }[] =
        [];
      try {
        attachments = await resolveArtifactAttachments(this.snapEvent, artifactIds, this.logger);
      } catch (err) {
        return this.fail(err instanceof Error ? err.message : String(err));
      }

      await sendGmailMessage(
        accessToken,
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

      // Track usage event for marketplace telemetry (non-blocking)
      // This runs after the snap-in successfully completes its main operation
      await this.trackUsageEvent({
        attachmentCount: attachments.length,
        bccCount: recipients.bcc.length,
        bodyFormat,
        ccCount: recipients.cc.length,
        eventType: 'gmail_email_sent',
        hasSubject: !!subjectRequired,
        operation: 'send_gmail_email',
        status: 'success',
        toCount: recipients.to.length,
      });

      return OperationOutput.fromJSON({
        output: {
          values: [{ error_message: '', success: true }],
        } as OutputValue,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('SendGmailEmailOp error:', error);

      // Track failure event for marketplace telemetry (non-blocking)
      await this.trackUsageEvent({
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        eventType: 'gmail_email_failed',
        operation: 'send_gmail_email',
        status: 'failure',
      });

      return this.fail(message);
    }
  }

  /**
   * Track usage event for DevRev marketplace telemetry
   * This method is fail-safe and will never throw errors that interrupt the main flow
   *
   * @param options - Usage event options
   */
  private async trackUsageEvent(options: {
    eventType: string;
    operation: string;
    status: 'success' | 'failure';
    attachmentCount?: number;
    bccCount?: number;
    bodyFormat?: string;
    ccCount?: number;
    errorType?: string;
    hasSubject?: boolean;
    toCount?: number;
  }): Promise<void> {
    try {
      this.logger.info('[LabsUsageTracker] Step 1: Initializing usage tracker...');

      const solutionName = 'Gmail Email Notification Snap-in';
      const version = packageJson.version || '1.0.0';

      this.logger.info(`[LabsUsageTracker] Solution: ${solutionName}, Version: ${version}`);

      // Step 2: Extract service account token from snap-in event context
      this.logger.info('[LabsUsageTracker] Step 2: Attempting to access service account token...');
      const tracker = LabsUsageTracker.fromSnapInEvent(this.snapEvent, solutionName, version);

      if (!tracker) {
        this.logger.info('[LabsUsageTracker] Step 2: Service account token not available, skipping usage tracking');
        this.logger.info(
          '[LabsUsageTracker] This is expected for snap-ins not deployed through DevRev Labs marketplace'
        );
        return;
      }

      this.logger.info('[LabsUsageTracker] Step 2: Service account token accessed successfully ✓');

      // Step 3: Build usage payload
      this.logger.info('[LabsUsageTracker] Step 3: Building usage event payload...');
      const usagePayload: Record<string, unknown> = {
        operation: options.operation,
        status: options.status,
      };

      // Add optional fields if present
      if (options.attachmentCount !== undefined) usagePayload['attachmentCount'] = options.attachmentCount;
      if (options.bccCount !== undefined) usagePayload['bccCount'] = options.bccCount;
      if (options.bodyFormat) usagePayload['bodyFormat'] = options.bodyFormat;
      if (options.ccCount !== undefined) usagePayload['ccCount'] = options.ccCount;
      if (options.errorType) usagePayload['errorType'] = options.errorType;
      if (options.hasSubject !== undefined) usagePayload['hasSubject'] = options.hasSubject;
      if (options.toCount !== undefined) usagePayload['toCount'] = options.toCount;

      this.logger.info('[LabsUsageTracker] Step 3: Payload built ✓');
      this.logger.info(`[LabsUsageTracker] Payload: ${JSON.stringify(usagePayload, null, 2)}`);

      // Step 4: Send usage event to DevRev Labs telemetry endpoint
      this.logger.info('[LabsUsageTracker] Step 4: Sending usage event to telemetry endpoint...');
      await tracker.trackUsageEvent(options.eventType, {
        payload: usagePayload,
        skipHealthCheck: false,
      });

      this.logger.info('[LabsUsageTracker] Step 4: Usage event sent successfully ✓');
      this.logger.info('[LabsUsageTracker] ✓ Usage tracking completed successfully');
    } catch (error) {
      // Catch any unexpected errors to ensure usage tracking never interrupts the main flow
      this.logger.info('[LabsUsageTracker] ✗ Usage tracking encountered an error (non-blocking)');
      this.logger.info(`[LabsUsageTracker] Error details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
