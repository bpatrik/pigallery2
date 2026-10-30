import * as path from 'path';
import * as http from 'http';
import {AddressInfo} from 'net';
import * as express from 'express';
import {NextFunction, Request, Response} from 'express';
import {expect} from 'chai';
import {RenderingMWs} from '../../../../src/backend/middlewares/RenderingMWs';

declare const beforeEach: any;
declare const afterEach: any;
declare const describe: any;
declare const it: any;

describe('RenderingMWs', () => {

  describe('renderFile', () => {
    const photo = path.join(__dirname, '../../assets/wild-1-small.jpg');
    let server: http.Server;
    let port: number;
    let errors: Error[];

    const listen = (app: express.Express): Promise<void> => {
      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
      let sent: Promise<void>;
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
});
