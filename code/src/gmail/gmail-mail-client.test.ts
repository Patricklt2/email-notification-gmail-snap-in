import axios from 'axios';

import { createGmailLogger } from '../lib/gmail-logger';
import { buildRawEmailMessage, sendGmailMessage } from './gmail-mail-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('buildRawEmailMessage', () => {
  it('builds a simple message when there are no attachments', () => {
    const raw = buildRawEmailMessage({
      attachments: [],
      bccAddresses: [],
      body: '<b>Hello</b>',
      bodyFormat: 'html',
      ccAddresses: [],
      subject: 'Test subject',
      toAddresses: ['a@example.com'],
    });

    expect(raw).toContain('MIME-Version: 1.0\r\n');
    expect(raw).toContain('Content-Type: text/html; charset=utf-8\r\n');
    expect(raw).toContain('Subject: Test subject\r\n');
    expect(raw).toContain('\r\n\r\n<b>Hello</b>');
  });

  it('builds multipart/mixed when attachments exist and includes a body part Content-Type', () => {
    const raw = buildRawEmailMessage({
      attachments: [
        {
          contentBase64: Buffer.from('%PDF-1.4', 'utf8').toString('base64'),
          contentType: 'application/pdf',
          filename: 'a.pdf',
        },
      ],
      bccAddresses: [],
      body: '<p>Body</p>',
      bodyFormat: 'html',
      ccAddresses: [],
      subject: 'With attachment',
      toAddresses: ['a@example.com'],
    });

    expect(raw).toContain('Content-Type: multipart/mixed; boundary="');
    expect(raw).toContain('Content-Type: text/html; charset=UTF-8\r\n');
    expect(raw).toContain('Content-Disposition: attachment; filename="a.pdf"\r\n');
    expect(raw).toContain('Content-Type: application/pdf; name="a.pdf"\r\n');
    expect(raw).toContain('Content-Transfer-Encoding: base64\r\n');
  });
});

describe('sendGmailMessage auth shapes', () => {
  const logger = createGmailLogger();
  const params = {
    attachments: [],
    bccAddresses: [],
    body: 'hello',
    bodyFormat: 'plain' as const,
    ccAddresses: [],
    subject: 'S',
    toAddresses: ['a@example.com'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses access token directly and skips the OAuth refresh when given { accessToken }', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 'm-1' }, status: 200 });

    const result = await sendGmailMessage({ accessToken: 'ya29.direct' }, params, logger);

    expect(result.messageId).toBe('m-1');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, , config] = mockedAxios.post.mock.calls[0];
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect((config as { headers: Record<string, string> }).headers['Authorization']).toBe('Bearer ya29.direct');
  });

  it('exchanges a refresh token for an access token when given manual credentials', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { access_token: 'ya29.refreshed' }, status: 200 })
      .mockResolvedValueOnce({ data: { id: 'm-2' }, status: 200 });

    const credentials = {
      clientId: 'cid',
      clientSecret: 'csec',
      redirectUri: 'urn:x',
      refreshToken: 'rtok',
    };
    const result = await sendGmailMessage(credentials, params, logger);

    expect(result.messageId).toBe('m-2');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    const [tokenUrl] = mockedAxios.post.mock.calls[0];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    const [, , sendConfig] = mockedAxios.post.mock.calls[1];
    expect((sendConfig as { headers: Record<string, string> }).headers['Authorization']).toBe('Bearer ya29.refreshed');
  });
});
