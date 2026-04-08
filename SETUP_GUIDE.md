# email-notification-gmail — Setup Guide

## Prerequisites

- DevRev CLI, Node.js 18+, npm
- Google Cloud project with **Gmail API** enabled
- OAuth 2.0 credentials (Web application or Desktop) and a **refresh token** for the sending account

## Step 1: Authenticate with DevRev

```bash
devrev profiles authenticate -o <your-org-slug> -u <your-email@domain.com>
```

## Step 2: Install and build

```bash
cd code
npm install
npm run build
npm run package
```

## Step 3: Google OAuth (Gmail API)

1. Create OAuth client ID / secret in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Gmail API** for the project.
3. OAuth scope: `https://www.googleapis.com/auth/gmail.send`
4. Obtain a **refresh token** (OAuth flow with the consent screen). Common redirect URI for scripts: `urn:ietf:wg:oauth:2.0:oob`
5. Store **client_id**, **client_secret**, **redirect_uri**, **refresh_token** — do not commit them to git.

## Step 4: DevRev keyring (UI)

The manifest declares a **custom keyring type** (`gmail-oauth-mail`) and operation slot **`gmail_oauth`**.

In **Configure** for the snap-in, set the **Gmail OAuth** keyring. The stored secret must be JSON with:

```json
{
  "client_id": "your-client-id.apps.googleusercontent.com",
  "client_secret": "your-client-secret",
  "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
  "refresh_token": "your-refresh-token"
}
```

Operation keyrings are declared under `operations[].keyrings` in `manifest.yaml`; the runtime resolves them from `input_data.keyrings` / `resources.keyrings` or via the snap-ins resources API when needed.

## Step 5: Deploy CLI

```bash
devrev snap_in_version create-one --path .   # from email-notification-gmail/ (parent of code/)
# or
devrev snap_in_version create-one --path ./email-notification-gmail --create-package
```

Then:

```bash
devrev snap_in draft
devrev snap_in update
devrev snap_in activate
```

## Step 6: Workflows

1. Add action **Send Gmail email** (`send_gmail_email`).
2. Bind the **Gmail OAuth** keyring in the step.
3. Fill **To**, **Subject**, **Body** (and optional CC/BCC). Set **Body format** to `html` or `plain`. For files, use **Attachments** (`artifact_ids`) — select one or more **artifacts** (the UI will pass artifact IDs automatically).

## Local fixture run

```bash
cd code
npm run start -- --functionName=operation_handler --fixturePath=send_gmail_email_operation.json
```

Use real credentials in the fixture only on a secure machine; prefer placeholders for CI.
