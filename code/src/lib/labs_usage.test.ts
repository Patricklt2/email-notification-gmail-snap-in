/**
 * Tests for Labs Usage Tracker
 */

import type { FunctionInput } from '@devrev/typescript-sdk/dist/snap-ins';
import axios from 'axios';

import { LabsUsageTracker } from './labs_usage';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LabsUsageTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console logs during tests
    jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fromSnapInEvent', () => {
    it('returns null when service_account_token is not present', () => {
      const event = {
        context: { secrets: {} },
      } as unknown as FunctionInput;

      const tracker = LabsUsageTracker.fromSnapInEvent(event, 'Test Solution', '1.0');

      expect(tracker).toBeNull();
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Service account token not found')
      );
    });

    it('returns tracker instance when service_account_token is present', () => {
      const event = {
        context: { secrets: { service_account_token: 'test-token-123' } },
      } as unknown as FunctionInput;

      const tracker = LabsUsageTracker.fromSnapInEvent(event, 'Test Solution', '1.0');

      expect(tracker).toBeInstanceOf(LabsUsageTracker);
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Service account token found and accessed successfully')
      );
    });

    it('returns tracker instance when access_token is present (fallback)', () => {
      const event = {
        context: { secrets: { access_token: 'test-access-token-456' } },
      } as unknown as FunctionInput;

      const tracker = LabsUsageTracker.fromSnapInEvent(event, 'Test Solution', '1.0');

      expect(tracker).toBeInstanceOf(LabsUsageTracker);
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Service account token found and accessed successfully')
      );
    });

    it('prefers service_account_token over access_token when both present', () => {
      const event = {
        context: {
          secrets: {
            service_account_token: 'service-token-123',
            access_token: 'access-token-456',
          },
        },
      } as unknown as FunctionInput;

      const tracker = LabsUsageTracker.fromSnapInEvent(event, 'Test Solution', '1.0');

      expect(tracker).toBeInstanceOf(LabsUsageTracker);
    });

    it('handles missing context gracefully', () => {
      const event = {} as unknown as FunctionInput;

      const tracker = LabsUsageTracker.fromSnapInEvent(event, 'Test Solution', '1.0');

      expect(tracker).toBeNull();
    });

    it('logs available secret keys when token is missing', () => {
      const event = {
        context: {
          secrets: {
            another_key: 'value',
            some_other_secret: 'secret',
          },
        },
      } as unknown as FunctionInput;

      LabsUsageTracker.fromSnapInEvent(event, 'Test Solution', '1.0');

      expect(console.info).toHaveBeenCalledWith(
        '[LabsUsageTracker] Available secret keys:',
        ['another_key', 'some_other_secret']
      );
    });
  });

  describe('trackUsageEvent', () => {
    it('performs health check and sends usage event successfully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await tracker.trackUsageEvent('test_event', {
        payload: { foo: 'bar' },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://usage.devrevlabs.ai/health',
        expect.objectContaining({ timeout: 5000 })
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://usage.devrevlabs.ai/usage_event',
        {
          event_type: 'test_event',
          payload: { foo: 'bar' },
          solution_name: 'Test Solution',
          version: '1.0',
        },
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        })
      );
    });

    it('skips health check when skipHealthCheck is true', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await tracker.trackUsageEvent('test_event', {
        skipHealthCheck: true,
      });

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('handles health check failure gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Health check failed'));
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      // Should not throw
      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Health check failed')
      );
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('handles usage event send failure gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      // Should not throw
      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage event send failed')
      );
    });

    it('uses custom timeout when provided', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
        timeout: 10000,
      });

      await tracker.trackUsageEvent('test_event');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 10000 })
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ timeout: 10000 })
      );
    });
  });

  describe('error handling - HTTP status codes', () => {
    it('handles HTTP 400 gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockResolvedValue({
        status: 400,
        data: { error: 'bad_request', message: 'Invalid payload' },
      });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage event returned HTTP 400')
      );
    });

    it('handles HTTP 401 gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockResolvedValue({
        status: 401,
        data: { error: 'unauthorized' },
      });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage event returned HTTP 401')
      );
    });

    it('handles HTTP 403 gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockResolvedValue({
        status: 403,
        data: { error: 'forbidden' },
      });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage event returned HTTP 403')
      );
    });

    it('handles HTTP 429 rate limit gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockResolvedValue({
        status: 429,
        data: { error: 'rate_limited', retry_after: 60 },
      });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage event returned HTTP 429')
      );
    });

    it('handles HTTP 500 gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockResolvedValue({
        status: 500,
        data: { error: 'internal_error' },
      });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage event returned HTTP 500')
      );
    });

    it('handles HTTP 503 service unavailable gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockResolvedValue({
        status: 503,
        data: 'Service Unavailable',
      });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage event returned HTTP 503')
      );
    });
  });

  describe('error handling - network errors', () => {
    it('handles network timeout gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      const timeoutError = new Error('timeout of 5000ms exceeded');
      (timeoutError as any).code = 'ECONNABORTED';
      mockedAxios.post.mockRejectedValue(timeoutError);

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Usage event send failed')
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Error code: ECONNABORTED')
      );
    });

    it('handles DNS resolution failure gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      const dnsError = new Error('getaddrinfo ENOTFOUND usage.devrevlabs.ai');
      (dnsError as any).code = 'ENOTFOUND';
      mockedAxios.post.mockRejectedValue(dnsError);

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Error code: ENOTFOUND')
      );
    });

    it('handles connection refused gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      const connError = new Error('connect ECONNREFUSED');
      (connError as any).code = 'ECONNREFUSED';
      mockedAxios.post.mockRejectedValue(connError);

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Error code: ECONNREFUSED')
      );
    });

    it('handles axios response error with HTTP status', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 403,
          data: { error: 'Forbidden', message: 'Invalid token' },
        },
      });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await tracker.trackUsageEvent('test_event');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Status: 403')
      );
      expect(console.info).toHaveBeenCalledWith(
        '[LabsUsageTracker]   Error response:',
        JSON.stringify({ error: 'Forbidden', message: 'Invalid token' })
      );
    });
  });

  describe('health check error handling', () => {
    it('handles health check HTTP errors gracefully', async () => {
      mockedAxios.get.mockResolvedValue({ status: 503 });
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Health check returned HTTP 503')
      );
      // Usage event should still be sent
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('handles health check network errors gracefully', async () => {
      const healthCheckError = new Error('connect ECONNREFUSED');
      (healthCheckError as any).code = 'ECONNREFUSED';
      mockedAxios.get.mockRejectedValue(healthCheckError);
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const tracker = new LabsUsageTracker({
        serviceToken: 'test-token',
        solutionName: 'Test Solution',
        version: '1.0',
      });

      await expect(tracker.trackUsageEvent('test_event')).resolves.not.toThrow();

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Health check failed')
      );
      // Usage event should still be sent despite health check failure
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });
});
