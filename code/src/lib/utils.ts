/**
 * Shared utility functions for the Gmail snap-in.
 *
 * Provides helpers for safe error message formatting (without leaking sensitive data).
 */

import { isAxiosError } from 'axios';

/**
 * Formats any thrown error value into a concise, safe human-readable string.
 *
 * Security note: For Axios HTTP errors, ONLY the HTTP status code and status text
 * are included. The request URL, headers, and request body are intentionally omitted
 * to prevent token or endpoint information from appearing in logs or error records
 * emitted to the DevRev platform.
 *
 * @param error - The caught error value (may be an AxiosError, Error, or any other type)
 * @returns A short string describing the error suitable for logging and error records
 *
 * @example
 *   formatError(new Error('oops'))                   // 'oops'
 *   formatError(axiosErrorWith404)                   // 'HTTP 404: Not Found'
 *   formatError('something went wrong')              // 'something went wrong'
 */
export function formatError(error: unknown): string {
  // Check if the error is an Axios HTTP error that has an HTTP response attached
  if (isAxiosError(error) && error.response) {
    // Only expose the numeric status code and its text description — never the URL
    return `HTTP ${error.response.status}: ${error.response.statusText}`;
  }
  // For standard JavaScript Error objects, return the descriptive message property
  if (error instanceof Error) {
    return error.message;
  }
  // Fallback: coerce any other value (string, number, object) to a plain string
  return String(error);
}
