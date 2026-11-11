import * as path from 'node:path';
import * as http from 'node:http';
import {AddressInfo} from 'node:net';
import express from 'express';
import {NextFunction, Request, Response} from 'express';
import * as chai from 'chai';
import {expect} from 'chai';
import {expectToFail} from '../../KnownFailures';
import {RenderingMWs} from '../../../../src/backend/middlewares/RenderingMWs';
import {TestHelper} from '../../../TestHelper';
import {ErrorCodes, ErrorDTO} from '../../../../src/common/entities/Error';

chai.should();

declare const beforeEach: any;
declare const afterEach: any;
declare const describe: any;
declare const it: any;

describe('RenderingMWs', () => {
  before(TestHelper.resetConfig);

  describe('renderFile', () => {
    const photo = path.join(__dirname, '../../assets/wild-1-small.jpg');
    let server: http.Server;
    let port: number;
    let errors: Error[];

    const listen = (app: express.Express): Promise<void> => {
      app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        errors.push(err);
        res.status(500).end();
      });
      return new Promise((resolve) => {
        server = app.listen(0, () => {
          port = (server.address() as AddressInfo).port;
          resolve();
        });
      });
    };

    const get = (url: string): Promise<http.IncomingMessage> =>
      new Promise((resolve, reject) => {
        http.get({port, path: url}, (res) => {
          res.resume();
          res.on('end', () => resolve(res));
        }).on('error', reject);
      });

    beforeEach(() => {
      errors = [];
    });

    afterEach((done: () => void) => {
      server.close(() => done());
    });

    it('should set Cache-Control on the file', async () => {
      const app = express();
      app.get('/file', (req: Request, res: Response, next: NextFunction) => {
        req.resultPipe = photo;
        next();
      }, RenderingMWs.renderFile);
      await listen(app);

      const res = await get('/file');
      expect(res.statusCode).to.equal(200);
      expect(res.headers['cache-control']).to.equal('private, max-age=86400');
    });

    it('should not set Cache-Control on an error', async () => {
      const app = express();
      app.get('/missing', (req: Request, res: Response, next: NextFunction) => {
        req.resultPipe = path.join(__dirname, 'not-existing.jpg');
        next();
      }, RenderingMWs.renderFile);
      await listen(app);

      const res = await get('/missing');
      expect(res.statusCode).to.equal(500);
      expect(res.headers['cache-control']).to.be.undefined;
      expect(errors).to.have.length(1);
    });

    it('should not report an aborted request as an error', async () => {
      const app = express();
      let sent!: Promise<void>; // assigned by the request handler before the client is done
      let received: () => void;
      const requestReceived = new Promise<void>((resolve) => received = resolve);
      app.get('/abort', (req: Request, res: Response, next: NextFunction) => {
        req.resultPipe = photo;
        sent = new Promise((resolve) => {
          // send the file only after the client went away
          res.on('close', () => {
            RenderingMWs.renderFile(req, res, next);
            // the error would reach the error handler on a later tick
            setTimeout(resolve, 50);
          });
        });
        received();
      });
      await listen(app);

      const clientReq = http.get({port, path: '/abort'});
      clientReq.on('error', (): void => {
        // the client aborts on purpose
      });
      await requestReceived;
      clientReq.destroy();
      await sent;

      expect(errors).to.be.empty;
    });
  });

  describe('renderError', () => {
    // The HTTP status of every error code (#1305). An ErrorDTO must never go out as a 2xx.
    const expectedStatus = (code: ErrorCodes): number => {
      switch (code) {
        case ErrorCodes.NOT_AUTHENTICATED:
        case ErrorCodes.NOT_AUTHENTICATED_SHARING:
        case ErrorCodes.CREDENTIAL_NOT_FOUND:
          return 401;
        case ErrorCodes.NOT_AUTHORISED:
        case ErrorCodes.PERMISSION_DENIED:
          return 403;
        case ErrorCodes.DIRECTORY_NOT_FOUND:
        case ErrorCodes.PATH_ERROR: // e.g. a file that is not on the disk anymore
          return 404;
        // the errors of what the user sent
        case ErrorCodes.ALREADY_AUTHENTICATED:
        case ErrorCodes.USER_CREATION_ERROR:
        case ErrorCodes.INPUT_ERROR:
        case ErrorCodes.SETTINGS_ERROR:
        case ErrorCodes.ALBUM_ERROR:
        case ErrorCodes.UPLOAD_ERROR:
          return 400;
        default:
          return 500;
      }
    };

    let server: http.Server;
    let port: number;

    before(async () => {
      const app = express();
      app.get('/error/:code', (req: Request, res: Response, next: NextFunction) => {
        next(new ErrorDTO(parseInt(req.params['code'] as string, 10) as ErrorCodes, 'test error'));
      });
      app.use(RenderingMWs.renderError);
      await new Promise<void>((resolve) => {
        server = app.listen(0, () => {
          port = (server.address() as AddressInfo).port;
          resolve();
        });
      });
    });

    after((done: () => void) => {
      server.close(() => done());
    });

    const get = (url: string): Promise<{ status: number, body: any }> =>
      new Promise((resolve, reject) => {
        http.get({port, path: url}, (res) => {
          let text = '';
          res.on('data', (c: Buffer) => text += c.toString('utf8'));
          res.on('end', () => resolve({status: res.statusCode!, body: JSON.parse(text)}));
        }).on('error', reject);
      });

    // the status of these is not decided yet: neither is a server fault, but the client needs the error body
    const undecided = [ErrorCodes.LocationLookUp_ERROR, ErrorCodes.USER_MANAGEMENT_DISABLED];
    const codes = Object.values(ErrorCodes)
      .filter((c): c is ErrorCodes => typeof c === 'number' && !undecided.includes(c));

    for (const code of codes) {
      it('should render ' + ErrorCodes[code] + ' with HTTP ' + expectedStatus(code), async () => {
        // renderError does not set a status yet, every error goes out as HTTP 200
        await expectToFail('#1305', async () => {
          const res = await get('/error/' + code);
          expect(res.body.error.code).to.equal(code);
          expect(res.status).to.equal(expectedStatus(code));
        }, /expected 200 to equal/);
      });
    }
  });
});
