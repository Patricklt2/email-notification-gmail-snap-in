/**
 * Parses the Gmail OAuth keyring secret. Supports two keyring shapes:
 *  - gmail-oauth-mail: JSON blob with manual OAuth client + refresh token (requires token exchange).
 *  - gmail-auto-oauth: raw access token string managed by DevRev (used directly as Bearer).
 */

export type GmailOAuthCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly refreshToken: string;
};

export type GmailKeyringParseResult =
  | { readonly credentials: GmailOAuthCredentials }
  | { readonly accessToken: string }
  | { readonly errorMessage: string };

export function parseGmailOAuthKeyringSecretJson(keyringSecretJson: string): GmailKeyringParseResult {
  const trimmed = keyringSecretJson.trim();
  let secretObj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { accessToken: trimmed };
    }
    secretObj = parsed as Record<string, unknown>;
  } catch {
    return { accessToken: trimmed };
  }

  const clientId = secretObj['client_id'];
  const clientSecret = secretObj['client_secret'];
  const redirectUri = secretObj['redirect_uri'];
  const refreshToken = secretObj['refresh_token'];
  if (
    typeof clientId === 'string' &&
    typeof clientSecret === 'string' &&
    typeof redirectUri === 'string' &&
    typeof refreshToken === 'string' &&
    clientId &&
    clientSecret &&
    redirectUri &&
    refreshToken
  ) {
    return {
      credentials: {
        clientId,
        clientSecret,
        redirectUri,
        refreshToken,
      },
    };
  }

  const accessToken = secretObj['access_token'];
  if (typeof accessToken === 'string' && accessToken.trim()) {
    return { accessToken: accessToken.trim() };
  }

  return {
    errorMessage: 'Keyring must include client_id, client_secret, redirect_uri, and refresh_token.',
  };
}
