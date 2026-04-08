/**
 * Structured logging for the Gmail email snap-in.
 * Never pass secrets, tokens, or raw keyring payloads into these methods.
 */

import type { LogLevelName } from '../config/log-level';
import { resolveLogLevel, shouldEmitLogLevel } from '../config/log-level';

const DEFAULT_NAMESPACE = '[gmail-email]';

export class GmailSnapInLogger {
  public constructor(private readonly namespace: string) {}

  public error(...args: unknown[]): void {
    this.emit('error', console.error, args);
  }

  public warn(...args: unknown[]): void {
    this.emit('warn', console.warn, args);
  }

  public info(...args: unknown[]): void {
    this.emit('info', console.log, args);
  }

  public debug(...args: unknown[]): void {
    this.emit('debug', console.log, args);
  }

  private emit(level: LogLevelName, sink: (...a: unknown[]) => void, payload: unknown[]): void {
    const minimum = resolveLogLevel();
    if (!shouldEmitLogLevel(minimum, level)) {
      return;
    }
    sink(this.namespace, ...payload);
  }
}

export function createGmailLogger(namespace: string = DEFAULT_NAMESPACE): GmailSnapInLogger {
  return new GmailSnapInLogger(namespace);
}
