import type { FunctionInput } from '@devrev/typescript-sdk/dist/snap-ins';

import { resolveGmailOAuthKeyringSecret, secretFromKeyringObject, secretFromKeyringsMap } from './gmail-keyring';

describe('gmail-keyring', () => {
  it('secretFromKeyringObject returns trimmed secret when present', () => {
    expect(secretFromKeyringObject({ secret: '  abc  ' })).toBe('  abc  ');
    expect(secretFromKeyringObject({ secret: '' })).toBeUndefined();
    expect(secretFromKeyringObject(null)).toBeUndefined();
  });

  it('secretFromKeyringsMap prefers gmail_oauth slot', () => {
    const out = secretFromKeyringsMap({ gmail_oauth: { secret: 's1' } });
    expect(out).toBe('s1');
  });

  it('secretFromKeyringsMap can resolve from string slot', () => {
    const out = secretFromKeyringsMap({ gmail_oauth: '  s2  ' });
    expect(out).toBe('s2');
  });

  it('resolveGmailOAuthKeyringSecret resolves from resources.keyrings.gmail_oauth.secret', () => {
    const event = {
      input_data: { resources: { keyrings: { gmail_oauth: { secret: 's3' } } } },
    } as unknown as FunctionInput;
    const out = resolveGmailOAuthKeyringSecret(event);
    expect(out).toBe('s3');
  });
});

