import {expect} from 'chai';
import express from 'express';
import * as http from 'node:http';
import {AddressInfo} from 'node:net';
import {ExpressRouterWrapper} from '../../../../../src/backend/model/extension/ExpressRouterWrapper';
import {ILogger} from '../../../../../src/backend/Logger';
import {UserRoles} from '../../../../../src/common/entities/UserDTO';
import {TestHelper} from '../../../../TestHelper';

// to help WebStorm to handle the test cases
declare let describe: any;
declare const before: any;
declare const after: any;
declare const beforeEach: any;
declare const it: any;


describe('ExpressRouterWrapper', () => {
  before(TestHelper.resetConfig);

  const errors: string[] = [];
  const logger: ILogger = {
    silly: () => undefined,
    debug: () => undefined,
    verbose: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: (...args) => {
      errors.push(args.join(' '));
    },
  };

  let api: ExpressRouterWrapper;
  let server: http.Server;
  let port: number;

  before(async () => {
    const router = express.Router();
    api = new ExpressRouterWrapper(router, 'test-ext', logger);
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.session = {context: {user: {name: 'admin', role: UserRoles.Admin}}} as express.Request['session'];
      next();
    });
    app.use(router);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  beforeEach(() => {
    errors.length = 0;
  });

  const request = (method: string, path: string, body?: unknown): Promise<{ status: number, json: any }> =>
    new Promise((resolve, reject) => {
      const req = http.request({host: '127.0.0.1', port, method, path, agent: false,
        headers: body ? {'Content-Type': 'application/json'} : {}}, (res) => {
        let text = '';
        res.on('data', (c) => text += c);
        res.on('end', () => resolve({status: res.statusCode, json: text.startsWith('{') ? JSON.parse(text) : null}));
      });
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });

  it('should register Express 5 paths', async () => {
    api.get.jsonResponse(['/item/:id'], null, (params) => ({id: params.id}));
    api.get.jsonResponse(['/files/*path'], null, (params) => ({path: params.path}));
    api.get.jsonResponse(['/opt{/:name}'], null, (params) => ({name: params.name ?? null}));

    expect((await request('GET', '/test-ext/item/%C3%A1rv%C3%ADz')).json.result).to.deep.equal({id: 'árvíz'});
    expect((await request('GET', '/test-ext/files/a/b%2Fc.jpg')).json.result).to.deep.equal({path: ['a', 'b/c.jpg']});
    expect((await request('GET', '/test-ext/opt')).json.result).to.deep.equal({name: null});
    expect((await request('GET', '/test-ext/opt/x')).json.result).to.deep.equal({name: 'x'});
    expect(errors).to.deep.equal([]);
  });

  it('should reject the Express 4 path syntax at compile time', () => {
    const noop = (): null => null;
    // @ts-expect-error optional param
    expect(() => api.get.jsonResponse(['/old/:id?'], null, noop)).to.not.throw();
    // @ts-expect-error regex param
    expect(() => api.get.jsonResponse(['/old/:id(\\d+)'], null, noop)).to.not.throw();
    // @ts-expect-error unnamed wildcard
    expect(() => api.get.rawMiddleware(['/old/*'], null, noop)).to.not.throw();
    // @ts-expect-error unnamed wildcard in the middle
    expect(() => api.post.mediaJsonResponse(['/ok', '/old/*/x'], null, false, noop)).to.not.throw();
  });

  it('should log and skip paths that Express 5 can not parse', async () => {
    // not literals, so only the runtime check sees them
    const oldPaths: string[] = ['/legacy/*'];
    const mixed: string[] = ['/mixed', '/mixed/:id?'];
    const ok: string[] = ['/still-ok'];

    expect(() => api.get.jsonResponse(oldPaths, null, () => 'legacy')).to.not.throw();
    expect(() => api.get.jsonResponse(mixed, null, () => 'mixed')).to.not.throw();
    expect(() => api.get.jsonResponse(ok, null, () => 'ok')).to.not.throw();

    expect(errors).to.have.lengthOf(2);
    expect(errors[0]).to.contain('/legacy/*').and.to.contain('Express 5');
    expect(errors[1]).to.contain('/mixed/:id?');
    // a skipped route is not reachable at all
    expect((await request('GET', '/test-ext/legacy/a')).status).to.equal(404);
    expect((await request('GET', '/test-ext/mixed')).status).to.equal(404);
    expect((await request('GET', '/test-ext/still-ok')).json.result).to.equal('ok');
  });

  it('should pass an empty body to the callback without a JSON body', async () => {
    api.get.jsonResponse(['/body'], null, (params, body) => ({body}));
    api.post.jsonResponse(['/body'], null, (params, body) => ({body}));

    expect((await request('GET', '/test-ext/body')).json.result).to.deep.equal({body: {}});
    expect((await request('POST', '/test-ext/body', {a: 'á'})).json.result).to.deep.equal({body: {a: 'á'}});
  });
});
