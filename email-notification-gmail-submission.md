# Snap-in Submission

**Name:** email-notification-gmail

**Categories:** Integration, Automation

**Tagline:** Automatically send personalized Gmail emails from any DevRev workflow using your own Google account.

**Summary:** The Send Gmail Email snap-in connects DevRev workflows to the Gmail API, enabling automated email delivery directly from your Google account. It supports rich HTML emails, CC/BCC recipients, and file attachments sourced from DevRev artifacts — giving teams full control over outbound communication without leaving their workflow.

**Overview:**

*Description*

The Send Gmail Email snap-in brings email communication directly into the DevRev workflow experience. Teams can trigger an email at any point in a workflow — whether notifying a customer of a status change, sending a report, or escalating an issue — all from a single action node configured in the DevRev Workflow Builder. Emails are sent from a Google account you own, keeping your branding and sender identity consistent.

Setting up the snap-in requires connecting your Google account once through a secure keyring. After that, any workflow in your DevRev organization can use the action to deliver emails automatically, with the subject, recipients, and content fully customizable using workflow variables. No additional email service or third-party account is required beyond a standard Gmail or Google Workspace account.

*Features*

1. Send emails from your own Gmail or Google Workspace account via Google OAuth2.
2. Compose emails in HTML or plain-text format.
3. Support for To, CC, and BCC recipient fields with multiple addresses per field.
4. Attach files to emails using DevRev artifacts — supports images, PDFs, and common document formats.
5. Inject dynamic workflow variables into the subject line, body, and recipient fields for personalized messaging.
6. Built-in `success` and `error_message` outputs enable conditional branching in workflows to handle delivery failures gracefully.
7. Secure credential storage via DevRev keyrings — OAuth credentials are encrypted and never exposed in workflow logs.
8. Attachment safeguards: enforces a 10-file limit, 25 MB total size cap, and blocks `.eml` files to prevent email loops.

**Keywords:** Gmail, email automation, workflow notification, Google OAuth, DevRev workflow, email attachment, customer communication, automated email
