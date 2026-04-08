import { buildRawEmailMessage } from './gmail-mail-client';

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

