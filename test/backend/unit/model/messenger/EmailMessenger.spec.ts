import {expect} from 'chai';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import {EmailMessenger} from '../../../../../src/backend/model/messenger/EmailMessenger';
import {MediaDTOWithThPath} from '../../../../../src/backend/model/messenger/Messenger';
import {Config} from '../../../../../src/common/config/private/Config';
import {TestHelper} from '../../../../TestHelper';

/**
 * Minimal SMTP server that accepts every mail (plain text, AUTH PLAIN/LOGIN) and keeps the raw messages.
 */
class SmtpSink {
  public readonly messages: { from: string, to: string[], data: string }[] = [];
  private server!: net.Server;

  async start(): Promise<number> {
    this.server = net.createServer((socket) => {
      let buffer = '';
      let inData = false;
      let authLoginStep = 0;
      let mail = {from: '', to: [] as string[], data: ''};
      const reply = (line: string): boolean => socket.write(line + '\r\n');
      reply('220 localhost ESMTP test sink');
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let idx: number;
        while (true) {
          if (inData) {
            idx = buffer.indexOf('\r\n.\r\n');
            if (idx === -1) {
              return;
            }
            mail.data = buffer.substring(0, idx);
            buffer = buffer.substring(idx + 5);
            inData = false;
            this.messages.push(mail);
            mail = {from: '', to: [], data: ''};
            reply('250 OK queued');
            continue;
          }
          idx = buffer.indexOf('\r\n');
          if (idx === -1) {
            return;
          }
          const line = buffer.substring(0, idx);
          buffer = buffer.substring(idx + 2);
          const cmd = line.toUpperCase();
          if (authLoginStep > 0) {
            authLoginStep = authLoginStep === 1 ? 2 : 0;
            reply(authLoginStep === 2 ? '334 UGFzc3dvcmQ6' : '235 Authentication successful');
          } else if (cmd.startsWith('EHLO')) {
            reply('250-localhost');
            reply('250-8BITMIME');
            reply('250 AUTH PLAIN LOGIN');
          } else if (cmd.startsWith('HELO')) {
            reply('250 localhost');
          } else if (cmd.startsWith('AUTH PLAIN')) {
            reply('235 Authentication successful');
          } else if (cmd.startsWith('AUTH LOGIN')) {
            authLoginStep = 1;
            reply('334 VXNlcm5hbWU6');
          } else if (cmd.startsWith('MAIL FROM:')) {
            mail.from = line.substring(10).trim();
            reply('250 OK');
          } else if (cmd.startsWith('RCPT TO:')) {
            mail.to.push(line.substring(8).trim());
            reply('250 OK');
          } else if (cmd === 'DATA') {
            inData = true;
            reply('354 End data with <CR><LF>.<CR><LF>');
          } else if (cmd === 'QUIT') {
            reply('221 Bye');
            socket.end();
          } else {
            reply('250 OK');
          }
        }
      });
      socket.on('error', () => {
        // the client may close the connection without QUIT
      });
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return (this.server.address() as net.AddressInfo).port;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

const decodeQuotedPrintable = (text: string): string => {
  const bytes = text.replace(/=\r\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return Buffer.from(bytes, 'latin1').toString('utf8');
};

describe('EmailMessenger', () => {
  before(TestHelper.resetConfig);

  const sink = new SmtpSink();
  beforeEach(async () => {
    sink.messages.length = 0;
    const port = await sink.start();
    Config.Messaging.Email.emailFrom = 'gallery@example.com';
    Config.Messaging.Email.smtp!.host = '127.0.0.1';
    Config.Messaging.Email.smtp!.port = port;
    Config.Messaging.Email.smtp!.secure = false;
    Config.Messaging.Email.smtp!.requireTLS = false;
    Config.Messaging.Email.smtp!.user = 'tester';
    Config.Messaging.Email.smtp!.password = 'secret';
    Config.Server.applicationTitle = 'Teszt Galéria';
  });
  afterEach(async () => {
    await sink.stop();
  });

  it('should send the photos as an html mail with inline attachments', async () => {
    const photoPath = path.join(__dirname, '/../../../assets/test image öüóőúéáű-.,.jpg');
    const media = [{
      name: 'test image öüóőúéáű-.,.jpg',
      thumbnailPath: photoPath,
      thumbnailUrl: 'https://example.com/thumb/1',
      metadata: {
        creationDate: Date.UTC(2020, 5, 1),
        positionData: {country: 'Magyarország'}
      }
    } as unknown as MediaDTOWithThPath];

    const messenger = new EmailMessenger();
    await (messenger as any).sendMedia({
      emailTo: 'user@example.com',
      emailSubject: 'Latest photos',
      emailText: 'Fotók neked:'
    }, media);

    expect(sink.messages).to.have.length(1);
    const msg = sink.messages[0];
    expect(msg.from).to.equal('<gallery@example.com>');
    expect(msg.to).to.deep.equal(['<user@example.com>']);
    expect(msg.data).to.match(/^Subject: Latest photos$/m);
    expect(msg.data).to.match(/^Content-Type: text\/html; charset=utf-8$/m);
    expect(msg.data).to.match(/^Content-Id: <img0>$/im);
    const html = decodeQuotedPrintable(msg.data);
    expect(html).to.contain('<h1 style="text-align: center; margin-bottom: 2em">Teszt Galéria</h1>');
    expect(html).to.contain('<h3>Fotók neked:</h3>');
    expect(html).to.contain('href="https://example.com/thumb/1"');
    expect(html).to.contain('src="cid:img0"');
    expect(html).to.contain('2020, Magyarország');
    // the attachment is the thumbnail file, base64 encoded in 76 char lines
    const base64 = msg.data.replace(/\r\n/g, '');
    expect(base64).to.contain(fs.readFileSync(photoPath).toString('base64'));
  });
});
