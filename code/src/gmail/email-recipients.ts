/**
 * Parses workflow To/CC/BCC strings into bare email addresses for Gmail MIME headers.
 */

export type GraphEmailRecipient = { emailAddress: { address: string; name?: string } };

export function parseEmailRecipient(raw: string): GraphEmailRecipient {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { emailAddress: { address: '' } };
  }
  const angleBracketMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (angleBracketMatch) {
    const displayName = angleBracketMatch[1].replace(/^["']|["']$/g, '').trim();
    const address = angleBracketMatch[2].trim();
    return displayName ? { emailAddress: { address, name: displayName } } : { emailAddress: { address } };
  }
  return { emailAddress: { address: trimmed } };
}

export function splitRecipientList(value: string | undefined): string[] {
  if (!value || !String(value).trim()) {
    return [];
  }
  return String(value)
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates and returns bare addresses for RFC822 To/Cc/Bcc lines.
 */
export function recipientLinesToValidatedAddresses(lines: string[]): string[] {
  const out: string[] = [];
  for (const segment of lines) {
    const r = parseEmailRecipient(segment);
    const addr = r.emailAddress.address.trim();
    if (!addr) {
      continue;
    }
    if (!EMAIL_REGEX.test(addr)) {
      throw new Error(`Invalid email address: ${segment}`);
    }
    out.push(addr);
  }
  return out;
}
