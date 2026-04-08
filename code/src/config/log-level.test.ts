import { logLevelRank, resolveLogLevel, shouldEmitLogLevel } from './log-level';

describe('log-level', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to info when env unset', () => {
    delete process.env['GMAIL_EMAIL_LOG_LEVEL'];
    delete process.env['GMAIL_EMAIL_LOG_CONFIG'];
    expect(resolveLogLevel()).toBe('info');
  });

  it('respects GMAIL_EMAIL_LOG_LEVEL', () => {
    process.env['GMAIL_EMAIL_LOG_LEVEL'] = 'debug';
    expect(resolveLogLevel()).toBe('debug');
  });

  it('shouldEmitLogLevel ranks correctly', () => {
    expect(shouldEmitLogLevel('info', 'error')).toBe(true);
    expect(shouldEmitLogLevel('info', 'debug')).toBe(false);
    expect(logLevelRank('debug')).toBeGreaterThan(logLevelRank('info'));
  });
});
