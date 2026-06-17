/**
 * Labs Usage Tracker for DevRev Marketplace Telemetry
 *
 * This module provides telemetry tracking for marketplace snap-ins.
 * It performs health checks and sends usage events to DevRev's usage API.
 *
 * All operations are non-blocking and failures are logged without throwing errors,
 * ensuring that telemetry issues never impact the main snap-in functionality.
 */

import { FunctionInput } from '@devrev/typescript-sdk/dist/snap-ins';
import axios from 'axios';

import { formatError } from './utils';

/**
 * Configuration for the Labs Usage Tracker
 */
interface LabsUsageConfig {
  /** Service account token for authentication */
  serviceToken: string;
  /** Solution name to report in usage events */
  solutionName: string;
  /** Solution version to report in usage events */
  version: string;
  /** Timeout for HTTP requests in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Usage event payload structure
 */
interface UsageEventPayload {
  solution_name: string;
  version: string;
  event_type: string;
  payload: Record<string, unknown>;
}

/**
 * Labs Usage Tracker
 *
 * Handles health checks and usage event reporting for DevRev marketplace telemetry.
 * Designed to be non-blocking and fail-safe.
 *
 * @example
 * ```typescript
 * const tracker = new LabsUsageTracker({
 *   serviceToken: 'your-token',
 *   solutionName: 'Gmail Email Notification Snap-in',
 *   version: '1.0'
 * });
 * await tracker.trackUsageEvent('gmail_email_sent');
 * ```
 */
export class LabsUsageTracker {
  private readonly serviceToken: string;

  private readonly solutionName: string;

  private readonly version: string;

  private readonly timeout: number;

  private readonly healthCheckUrl = 'https://usage.devrevlabs.ai/health';

  private readonly usageEventUrl = 'https://usage.devrevlabs.ai/usage_event';

  constructor(config: LabsUsageConfig) {
    this.serviceToken = config.serviceToken;
    this.solutionName = config.solutionName;
    this.version = config.version;
    this.timeout = config.timeout ?? 5000;
  }

  /**
   * Performs a health check against the usage API
   *
   * @returns Promise that resolves when health check completes (success or failure)
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.info('[LabsUsageTracker]   → Performing health check...');
      const response = await axios.get(this.healthCheckUrl, {
        timeout: this.timeout,
        validateStatus: () => true, // Accept all status codes
      });

      if (response.status >= 200 && response.status < 300) {
        console.info(`[LabsUsageTracker]   ✓ Health check successful (HTTP ${response.status})`);
      } else {
        console.info(`[LabsUsageTracker]   ⚠ Health check returned HTTP ${response.status} (non-critical)`);
      }
    } catch (error) {
      // Catch network errors, timeouts, etc.
      console.info(`[LabsUsageTracker]   ⚠ Health check failed (non-critical): ${formatError(error)}`);
      if (error && typeof error === 'object' && 'code' in error) {
        const networkError = error as { code?: string };
        console.info(`[LabsUsageTracker]   Error code: ${networkError.code}`);
      }
    }
  }

  /**
   * Sends a usage event to the DevRev usage API
   *
   * @param eventType - The type of event to report (e.g., 'gmail_email_sent')
   * @param payload - Optional additional payload data
   * @returns Promise that resolves when the event is sent (success or failure)
   */
  private async sendUsageEvent(eventType: string, payload: Record<string, unknown> = {}): Promise<void> {
    try {
      const eventPayload: UsageEventPayload = {
        event_type: eventType,
        payload,
        solution_name: this.solutionName,
        version: this.version,
      };

      console.info('[LabsUsageTracker]   → Sending usage event...');
      console.info('[LabsUsageTracker]   Event payload:', JSON.stringify(eventPayload, null, 2));

      const response = await axios.post(this.usageEventUrl, eventPayload, {
        headers: {
          Authorization: `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
        // Accept all status codes - we'll handle them in catch block
        validateStatus: () => true,
      });

      // Check if the response was successful (2xx status codes)
      if (response.status >= 200 && response.status < 300) {
        console.info(`[LabsUsageTracker]   ✓ Usage event sent successfully (HTTP ${response.status})`);
      } else {
        // Log non-2xx responses as warnings but don't throw
        console.info(`[LabsUsageTracker]   ⚠ Usage event returned HTTP ${response.status}`);
        if (response.data) {
          console.info('[LabsUsageTracker]   Response body:', JSON.stringify(response.data));
        }
      }
    } catch (error) {
      // Catch ALL errors: network errors, timeouts, DNS failures, etc.
      console.info(`[LabsUsageTracker]   ✗ Usage event send failed: ${formatError(error)}`);

      // Log additional error details if available
      if (error && typeof error === 'object') {
        // Axios error with response (4xx, 5xx already handled above, but catch any edge cases)
        if ('response' in error) {
          const axiosError = error as { response?: { status?: number; data?: unknown } };
          if (axiosError.response) {
            console.info(`[LabsUsageTracker]   HTTP Status: ${axiosError.response.status}`);
            if (axiosError.response.data) {
              console.info('[LabsUsageTracker]   Error response:', JSON.stringify(axiosError.response.data));
            }
          }
        }
        // Network/timeout errors
        if ('code' in error) {
          const networkError = error as { code?: string; message?: string };
          console.info(`[LabsUsageTracker]   Error code: ${networkError.code}`);
        }
      }
    }
  }

  /**
   * Tracks a usage event with optional health check
   *
   * This is the main entry point for tracking usage. It performs a health check
   * (if enabled) and then sends the usage event. Both operations are non-blocking
   * and failures are logged without throwing errors.
   *
   * @param eventType - The type of event to report (e.g., 'gmail_email_sent')
   * @param options - Optional configuration
   * @param options.skipHealthCheck - Skip the health check (default: false)
   * @param options.payload - Additional payload data to include in the event
   * @returns Promise that resolves when tracking is complete
   */
  async trackUsageEvent(
    eventType: string,
    options: {
      skipHealthCheck?: boolean;
      payload?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    console.info('[LabsUsageTracker] ═══════════════════════════════════════════');
    console.info('[LabsUsageTracker] Starting usage event tracking');
    console.info(`[LabsUsageTracker] Event type: ${eventType}`);

    try {
      // Perform health check unless explicitly skipped
      if (!options.skipHealthCheck) {
        console.info('[LabsUsageTracker] Step 1: Health check');
        await this.performHealthCheck();
      } else {
        console.info('[LabsUsageTracker] Step 1: Health check (skipped)');
      }

      // Send usage event
      console.info('[LabsUsageTracker] Step 2: Send usage event');
      await this.sendUsageEvent(eventType, options.payload);

      console.info('[LabsUsageTracker] ✓ Usage event tracking completed successfully');
    } catch (error) {
      console.info(`[LabsUsageTracker] ✗ Unexpected error during tracking: ${formatError(error)}`);
    } finally {
      console.info('[LabsUsageTracker] ═══════════════════════════════════════════');
    }
  }

  /**
   * Factory method to create a tracker from snap-in event context
   *
   * @param event - The snap-in function input event
   * @param solutionName - Name of the solution
   * @param version - Version of the solution
   * @returns A new LabsUsageTracker instance, or null if token is not available
   */
  static fromSnapInEvent(event: FunctionInput, solutionName: string, version: string): LabsUsageTracker | null {
    try {
      console.info('[LabsUsageTracker] Checking for service account token in event context...');

      // Access service_account_token from snap-in event context, with fallback to access_token
      // This follows the same pattern as Article to PDF snap-in
      const serviceToken = (event.context?.secrets?.['service_account_token'] ||
        event.context?.secrets?.['access_token']) as string | undefined;

      if (!serviceToken) {
        console.info('[LabsUsageTracker] ✗ Service account token not found in event.context.secrets');
        console.info('[LabsUsageTracker] Available secret keys:', Object.keys(event.context?.secrets || {}));
        console.info(
          '[LabsUsageTracker] Usage tracking will be skipped (this is expected for non-marketplace deployments)'
        );
        return null;
      }

      console.info('[LabsUsageTracker] ✓ Service account token found and accessed successfully');
      console.info(`[LabsUsageTracker] Token length: ${serviceToken.length} characters`);

      return new LabsUsageTracker({
        serviceToken,
        solutionName,
        version,
      });
    } catch (error) {
      console.info(`[LabsUsageTracker] ✗ Error creating tracker from event: ${formatError(error)}`);
      return null;
    }
  }
}
