import { parseGmailOAuthKeyringSecretJson } from './gmail-oauth-credentials';

describe('parseGmailOAuthKeyringSecretJson', () => {
  it('parses gmail-oauth-mail JSON into credentials', () => {
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

  it('returns error when JSON object is missing manual-OAuth fields and has no access_token', () => {
    const r = parseGmailOAuthKeyringSecretJson('{}');
    expect('errorMessage' in r).toBe(true);
  });

  it('treats a bare non-JSON string as a gmail-auto-oauth access token', () => {
    const r = parseGmailOAuthKeyringSecretJson('ya29.a0AfH6SMB-not-json');
    expect('accessToken' in r).toBe(true);
    if ('accessToken' in r) {
      expect(r.accessToken).toBe('ya29.a0AfH6SMB-not-json');
    }
  });

  it('trims whitespace around a bare access token', () => {
    const r = parseGmailOAuthKeyringSecretJson('   ya29.token   ');
    expect('accessToken' in r).toBe(true);
    if ('accessToken' in r) {
      expect(r.accessToken).toBe('ya29.token');
    }
  });

  it('treats a JSON-quoted string literal as an access token', () => {
    const r = parseGmailOAuthKeyringSecretJson('"ya29.json-quoted"');
    expect('accessToken' in r).toBe(true);
    if ('accessToken' in r) {
      expect(r.accessToken).toBe('"ya29.json-quoted"');
    }
  });

  it('extracts access_token from a JSON object when manual fields are absent', () => {
    const j = JSON.stringify({ access_token: 'ya29.from-object' });
    const r = parseGmailOAuthKeyringSecretJson(j);
    expect('accessToken' in r).toBe(true);
    if ('accessToken' in r) {
      expect(r.accessToken).toBe('ya29.from-object');
    }
  });

  it('prefers manual credentials over access_token when both are present', () => {
    const j = JSON.stringify({
      access_token: 'ya29.ignored',
      client_id: 'id',
      client_secret: 'sec',
      redirect_uri: 'urn:x',
      refresh_token: 'rt',
    });
    const r = parseGmailOAuthKeyringSecretJson(j);
    expect('credentials' in r).toBe(true);
  });
});
