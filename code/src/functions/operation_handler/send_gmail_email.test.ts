import { FunctionInput, OperationOutput } from '@devrev/typescript-sdk/dist/snap-ins';

import { resolveArtifactAttachments } from '../../devrev/devrev-artifacts';
import { sendGmailMessage } from '../../gmail/gmail-mail-client';
import { resolveGmailOAuthKeyringSecret, SendGmailEmailOp } from './send_gmail_email';

jest.mock('../../gmail/gmail-mail-client', () => ({
  sendGmailMessage: jest.fn().mockResolvedValue({ messageId: 'mock-msg-id' }),
}));

jest.mock('../../devrev/devrev-artifacts', () => ({
  resolveArtifactAttachments: jest.fn().mockResolvedValue([]),
}));

const mockedSendGmail = sendGmailMessage as jest.MockedFunction<typeof sendGmailMessage>;
const mockedResolveArtifacts = resolveArtifactAttachments as jest.MockedFunction<typeof resolveArtifactAttachments>;

const TEST_ACCESS_TOKEN = 'ya29.test-access-token';

function baseEvent(overrides: Partial<FunctionInput> = {}): FunctionInput {
  return {
    context: {
      automation_id: '',
      dev_oid: 'devo:1',
      secrets: { service_account_token: 't' },
      service_account_id: 's',
      snap_in_id: 'si',
      snap_in_version_id: 'sv',
      source_id: 'src',
    },
    execution_metadata: { devrev_endpoint: 'https://api.devrev.ai', function_name: 'op', request_id: '' },
    input_data: {
      event_sources: {},
      global_values: {},
      resources: {
        keyrings: {
          gmail_oauth: {
            id: 'k1',
            secret: TEST_ACCESS_TOKEN,
            type_id: 'gmail-oauth',
          },
        },
      },
    },
    payload: {},
    ...overrides,
  } as FunctionInput;
}

describe('SendGmailEmailOp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns failure when keyring is missing', async () => {
    const ev = baseEvent({
      input_data: {
        event_sources: {},
        global_values: {},
        resources: { keyrings: {} },
      },
    } as Partial<FunctionInput>);
    const op = new SendGmailEmailOp(ev);
    const out = await op.run(op.GetContext(), {
      data: { body: 'B', subject: 'S', to: 'x@y.com' },
      metadata: { namespace: 'devrev', slug: 'send_gmail_email' },
    } as never);
    const j = OperationOutput.toJSON(out) as {
      output?: { values?: Array<{ success: boolean; error_message?: string }> };
    };
    expect(j.output?.values?.[0]?.success).toBe(false);
    expect(j.output?.values?.[0]?.error_message).toMatch(/connection|Gmail OAuth/i);
    expect(mockedSendGmail).not.toHaveBeenCalled();
  });

  it('returns failure when To is empty', async () => {
    const ev = baseEvent();
    const op = new SendGmailEmailOp(ev);
    const out = await op.run(op.GetContext(), {
      data: { body: 'B', subject: 'S', to: '' },
      metadata: { namespace: 'devrev', slug: 'send_gmail_email' },
    } as never);
    const j = OperationOutput.toJSON(out) as { output?: { values?: Array<{ success: boolean }> } };
    expect(j.output?.values?.[0]?.success).toBe(false);
  });

  it('sends mail when keyring resolves', async () => {
    const ev = baseEvent();
    const op = new SendGmailEmailOp(ev);
    const out = await op.run(op.GetContext(), {
      data: {
        bcc: 'bcc@example.com',
        body: '<p>Body</p>',
        cc: 'cc@example.com',
        subject: 'Hi',
        to: 'Jane <jane@example.com>, bob@example.com',
      },
      metadata: { namespace: 'devrev', slug: 'send_gmail_email' },
    } as never);

    const j = OperationOutput.toJSON(out) as { output?: { values?: Array<{ success: boolean }> } };
    expect(j.output?.values?.[0]?.success).toBe(true);
    expect(mockedSendGmail).toHaveBeenCalled();
    expect(mockedSendGmail.mock.calls[0][1]).toMatchObject({
      attachments: [],
      body: '<p>Body</p>',
      bodyFormat: 'html',
    });
  });

  it('uses plain body format when body_format is plain', async () => {
    const ev = baseEvent();
    const op = new SendGmailEmailOp(ev);
    await op.run(op.GetContext(), {
      data: {
        body: 'Plain only',
        body_format: 'plain',
        subject: 'S',
        to: 'a@b.com',
      },
      metadata: { namespace: 'devrev', slug: 'send_gmail_email' },
    } as never);
    expect(mockedSendGmail.mock.calls[0][1]).toMatchObject({
      body: 'Plain only',
      bodyFormat: 'plain',
    });
  });

  it('passes artifact attachments to sendGmailMessage', async () => {
    const ev = baseEvent();
    const op = new SendGmailEmailOp(ev);
    mockedResolveArtifacts.mockResolvedValueOnce([
      { contentBase64: Buffer.from('%PDF-1').toString('base64'), contentType: 'application/pdf', filename: 'doc.pdf' },
    ]);
    await op.run(op.GetContext(), {
      data: {
        artifact_ids: ['art:1'],
        body: '<p>See attached</p>',
        subject: 'S',
        to: 'a@b.com',
      },
      metadata: { namespace: 'devrev', slug: 'send_gmail_email' },
    } as never);
    const arg = mockedSendGmail.mock.calls[0][1];
    expect(arg.attachments).toHaveLength(1);
    expect(arg.attachments[0].filename).toBe('doc.pdf');
    expect(arg.attachments[0].contentType).toBe('application/pdf');
  });

  it('treats legacy attachments string as a single artifact id', async () => {
    const ev = baseEvent();
    const op = new SendGmailEmailOp(ev);
    const out = await op.run(op.GetContext(), {
      data: {
        attachments: '[not-json]',
        body: 'B',
        subject: 'S',
        to: 'a@b.com',
      },
      metadata: { namespace: 'devrev', slug: 'send_gmail_email' },
    } as never);
    const j = OperationOutput.toJSON(out) as {
      output?: { values?: Array<{ success: boolean; error_message?: string }> };
    };
    expect(j.output?.values?.[0]?.success).toBe(true);
    expect(mockedResolveArtifacts).toHaveBeenCalledWith(expect.anything(), ['[not-json]'], expect.anything());
  });

  it('resolves keyring from input_data.keyrings when resources.keyrings is empty', async () => {
    const accessToken = 'ya29.top-level-token';
    const ev = baseEvent({
      input_data: {
        event_sources: {},
        global_values: {},
        keyrings: {
          gmail_oauth: {
            id: 'k-top',
            secret: accessToken,
            type_id: 'gmail-oauth',
          },
        },
        resources: { keyrings: {} },
      },
    } as Partial<FunctionInput>);

    expect(resolveGmailOAuthKeyringSecret(ev)).toBe(accessToken);

    const op = new SendGmailEmailOp(ev);
    const out = await op.run(op.GetContext(), {
      data: { body: '<p>x</p>', subject: 'S', to: 'a@b.com' },
      metadata: { namespace: 'devrev', slug: 'send_gmail_email' },
    } as never);

    const j = OperationOutput.toJSON(out) as { output?: { values?: Array<{ success: boolean }> } };
    expect(j.output?.values?.[0]?.success).toBe(true);
    expect(mockedSendGmail.mock.calls[0][0]).toBe(accessToken);
  });

  it('passes the keyring secret as the access token to sendGmailMessage', async () => {
    const ev = baseEvent();
    const op = new SendGmailEmailOp(ev);
    await op.run(op.GetContext(), {
      data: { body: 'B', subject: 'S', to: 'a@b.com' },
      metadata: { namespace: 'devrev', slug: 'send_gmail_email' },
    } as never);
    expect(mockedSendGmail.mock.calls[0][0]).toBe(TEST_ACCESS_TOKEN);
  });
});
