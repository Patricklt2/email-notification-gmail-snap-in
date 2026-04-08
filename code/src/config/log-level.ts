/**
 * Resolves the minimum log level for the Gmail snap-in.
 * Precedence: `GMAIL_EMAIL_LOG_LEVEL` env → optional JSON file → default `info`.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Supported severity names (aligned with common logging conventions). */
export type LogLevelName = 'error' | 'warn' | 'info' | 'debug';

/** Numeric order: higher index means more verbose output. */
const LOG_LEVEL_ORDER: Record<LogLevelName, number> = {
  debug: 3,
  error: 0,
  info: 2,
  warn: 1,
};

function isLogLevelName(value: string): value is LogLevelName {
  const normalized = value.trim().toLowerCase();
  return normalized === 'error' || normalized === 'warn' || normalized === 'info' || normalized === 'debug';
}

function parseLogLevelName(value: string): LogLevelName | undefined {
  const normalized = value.trim().toLowerCase();
  if (isLogLevelName(normalized)) {
    return normalized;
  }
  return undefined;
}

function readLogLevelFromJsonFile(filePath: string): LogLevelName | undefined {
  try {
    if (!existsSync(filePath)) {
      return undefined;
    }
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { logLevel?: unknown };
    if (typeof parsed.logLevel !== 'string') {
      return undefined;
    }
    return parseLogLevelName(parsed.logLevel);
  } catch {
    return undefined;
  }
}

export function resolveLogLevel(): LogLevelName {
  const envRaw = process.env['GMAIL_EMAIL_LOG_LEVEL'];
  if (envRaw !== undefined && envRaw !== '') {
    const parsed = parseLogLevelName(envRaw);
    if (parsed) {
      return parsed;
    }
  }

  const explicitPath = process.env['GMAIL_EMAIL_LOG_CONFIG'];
  if (explicitPath) {
    const fromExplicit = readLogLevelFromJsonFile(explicitPath);
    if (fromExplicit) {
      return fromExplicit;
    }
  }

  const cwdSettings = join(process.cwd(), 'logging.settings.json');
  const fromCwd = readLogLevelFromJsonFile(cwdSettings);
  if (fromCwd) {
    return fromCwd;
  }

  return 'info';
}

export function shouldEmitLogLevel(configuredLevel: LogLevelName, messageLevel: LogLevelName): boolean {
  return LOG_LEVEL_ORDER[messageLevel] <= LOG_LEVEL_ORDER[configuredLevel];
}

export function logLevelRank(level: LogLevelName): number {
  return LOG_LEVEL_ORDER[level];
}
