/**
 * Parses the Gmail OAuth keyring JSON blob into discrete Google OAuth fields.
 */

export type GmailOAuthCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly refreshToken: string;
};

export function parseGmailOAuthKeyringSecretJson(
  keyringSecretJson: string
): { readonly credentials: GmailOAuthCredentials } | { readonly errorMessage: string } {
  try {
    const secretObj = JSON.parse(keyringSecretJson) as Record<string, string>;
    const clientId = secretObj['client_id'];
    const clientSecret = secretObj['client_secret'];
    const redirectUri = secretObj['redirect_uri'];
    const refreshToken = secretObj['refresh_token'];
    if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
      return {
        errorMessage: 'Keyring must include client_id, client_secret, redirect_uri, and refresh_token.',
      };
    }
    return {
      credentials: {
        clientId,
        clientSecret,
        redirectUri,
        refreshToken,
      },
    };
  } catch {
    return { errorMessage: 'Invalid keyring secret format.' };
  }
}
