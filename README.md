# email-notification-gmail

DevRev snap-in that exposes a workflow **action** — **Send Gmail email** — which sends messages through the **Gmail API** using **Google OAuth2** (refresh token).

## What this project is

This snap-in is designed for **DevRev workflows**. You add the action node, provide recipients/subject/body, and optionally pass **DevRev artifact IDs** to attach files (images, PDFs, etc.).

## Project structure (this folder)

- `manifest.yaml`: Snap-in definition (operation schema, keyrings, function wiring).
- `code/`: Node/TypeScript implementation (runtime entrypoint, operation handler, Gmail client, tests).
  - `src/functions/operation_handler/`: Workflow operation dispatch + `send_gmail_email`.
  - `src/gmail/`: Gmail/OAuth helpers + RFC 2822/MIME message builder.
  - `src/devrev/`: Artifact metadata/download helpers for attachments.
  - `src/lib/`: Shared logger.

## Dependencies

Key runtime dependencies (see `code/package.json` for the full list):

- `googleapis`: Gmail API client
- `@devrev/typescript-sdk`: Snap-in runtime types + DevRev API client (for `artifactsLocate`)
- `axios`: HTTP requests for artifact metadata/download

## Repository layout

| Path | Purpose |
|------|---------|
| `manifest.yaml` | Snap-in metadata: operations, Gmail keyring type, function wiring. |
| `code/` | TypeScript implementation, tests, and `package.json`. |
| `code/src/config/` | Log level resolution (`GMAIL_EMAIL_LOG_LEVEL`, optional JSON settings). |
| `code/src/gmail/` | Gmail API client, keyring resolution, recipient parsing. |
| `code/src/lib/` | Shared `GmailSnapInLogger`. |
| `code/src/functions/operation_handler/` | `SendGmailEmailOp` and event debug logging. |

## Features

- **Gmail API** via `googleapis` and OAuth2 refresh token
- **Operation keyring** `gmail_oauth` (declared in manifest `keyring_types` → `gmail-oauth-mail`)
- **Workflow inputs**: To, CC, BCC, Subject, Body, optional **body format** (HTML or plain), optional **attachments** (DevRev artifact IDs)
- **Outputs**: `success` (bool), `error_message` (text)

## Input fields

| Field | Required | Description |
|-------|----------|-------------|
| `to` | Yes | Comma-separated recipients (`Name <email>` or `email`) |
| `cc` | No | CC recipients |
| `bcc` | No | BCC recipients |
| `subject` | Yes | Subject line |
| `body` | Yes | Body content (interpreted as HTML or plain per `body_format`) |
| `body_format` | No | `html` (default) or `plain` |
| `artifact_ids` | No | Attachment picker: **array of artifact IDs** (workflow UI enforces artifacts). |

### Attachments example

```text
["art:123", "art:456"]
```

Limits (enforced in code): up to 10 files, total metadata+download size must not exceed 25 MB, and `.eml` files are blocked (to prevent email loops). Stay within [Gmail sending limits](https://support.google.com/a/answer/166852).

## Quick start

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for Google Cloud OAuth and DevRev keyring.

```bash
cd code
npm install
npm test
npm run build
npm run start -- --functionName=operation_handler --fixturePath=send_gmail_email_operation.json
```

## Deploy using DevRev CLI

Run these commands from a terminal (from the parent repo that contains this `email-notification-gmail/` folder and its `manifest.yaml`):

```bash
devrev profiles authenticate --org <org-slug> --usr <email>
devrev snap_in_version create-one --path ./email-notification-gmail --create-package
devrev snap_in draft
devrev snap_in update
devrev snap_in activate
```

### Logging

- `GMAIL_EMAIL_LOG_LEVEL` — `error` | `warn` | `info` | `debug`
- Optional `logging.settings.json` in `code/` (see `logging.settings.example.json`)
- `GMAIL_EMAIL_LOG_RAW_EVENT=1` — logs full event (secrets); **localhost only**

### Lint

```bash
npm run lint
npm run lint:fix
```

For DevRev snap-in reference, see [Snap-in development](https://developer.devrev.ai/snapin-development/).
