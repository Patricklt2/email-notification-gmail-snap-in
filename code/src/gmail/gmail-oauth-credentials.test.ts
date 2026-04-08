import { parseGmailOAuthKeyringSecretJson } from './gmail-oauth-credentials';

describe('parseGmailOAuthKeyringSecretJson', () => {
  it('parses valid JSON', () => {
    const j = JSON.stringify({
      client_id: 'id',
      client_secret: 'sec',
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      refresh_token: 'rt',
    });
    const r = parseGmailOAuthKeyringSecretJson(j);
    expect('credentials' in r).toBe(true);
    if ('credentials' in r) {
      expect(r.credentials.clientId).toBe('id');
      expect(r.credentials.refreshToken).toBe('rt');
    }
  });

  it('returns error on missing fields', () => {
    const r = parseGmailOAuthKeyringSecretJson('{}');
    expect('errorMessage' in r).toBe(true);
  });
});
