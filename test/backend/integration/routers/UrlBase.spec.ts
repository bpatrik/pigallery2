import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as chai from 'chai';
import {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {default as chaiHttp, request} from 'chai-http';
import {SuperAgentStatic} from 'superagent';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';

process.env['NODE_ENV'] = 'test';
chai.should();
chai.use(chaiHttp);
chai.use(chaiAsPromised);

/**
 * Running under a reverse-proxy subpath (`Server.urlBase`, e.g. https://example.com/myGallery, #1254).
 * Today the server expects the proxy to strip the urlBase: it serves everything at `/` and only the links
 * it renders (base href, redirects, client config) carry the urlBase.
 */
describe('Server.urlBase', () => {
  before(TestHelper.resetConfig);

  const sqlHelper = new DBTestHelper(DatabaseType.sqlite);
  const URL_BASE = '/myGallery';
  const ALBUM = 'Árvíztűrő mappa';
  let server: Server;
  let frontendFolder: string;

  before(async () => {
    await sqlHelper.initDB();
    const mediaDir = path.join(TestHelper.TMP_DIR, 'urlbase-media');
    fs.mkdirSync(path.join(mediaDir, ALBUM), {recursive: true});
    fs.copyFileSync(path.join(__dirname, '../../assets/wild-1-small.jpg'), path.join(mediaDir, ALBUM, 'kép.jpg'));
    Config.Users.authenticationRequired = false;
    Config.Server.urlBase = URL_BASE;
    Config.Media.folder = mediaDir;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'urlbase-temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();

    frontendFolder = ProjectPath.FrontendFolder;
    ProjectPath.FrontendFolder = path.join(TestHelper.TMP_DIR, 'urlbase-frontend');
    // the real template
    const template = fs.readFileSync(path.join(__dirname, '../../../../src/frontend/index.html'), 'utf8');
    fs.mkdirSync(path.join(ProjectPath.FrontendFolder, 'en', 'assets'), {recursive: true});
    fs.writeFileSync(path.join(ProjectPath.FrontendFolder, 'en', 'index.html'), template);
    fs.writeFileSync(path.join(ProjectPath.FrontendFolder, 'en', 'assets', 'logo.png'), 'assets/logo.png');
  });

  after(async () => {
    ProjectPath.FrontendFolder = frontendFolder;
    await sqlHelper.clearDB();
    TestHelper.resetConfig();
  });

  const get = (url: string): Promise<any> =>
    (request.execute(server.Server) as SuperAgentStatic).get(url).redirects(0);

  describe('behind a proxy that strips the urlBase', () => {

    it('should render the app with the urlBase as base href', async () => {
      for (const url of ['/', '/gallery/' + encodeURIComponent(ALBUM), '/search/a', '/login']) {
        const res = await get(url);
        expect(res.status, url).to.equal(200);
        expect(res.text, url).to.contain('<base href="' + URL_BASE + '/"/>');
      }
    });

    it('should send the urlBase to the client in its config', async () => {
      const res = await get('/');
      const config = res.text.substring(res.text.indexOf('ConfigInject: ') + 'ConfigInject: '.length, res.text.indexOf(', UIExtensionConfigs'));
      expect(JSON.parse(config).Server.urlBase).to.equal(URL_BASE);
    });

    it('should answer the API at the api path', async () => {
      const res = await get(Config.Server.apiPath + '/gallery/content/' + encodeURIComponent(ALBUM));
      res.should.have.status(200);
      expect(res.body.error).to.equal(null);
      expect(res.body.result.directory.name).to.equal(ALBUM);
    });

    it('should serve the assets', async () => {
      const res = await get('/assets/logo.png');
      res.should.have.status(200);
      expect(res.body.toString()).to.equal('assets/logo.png');
    });

    it('should redirect the language links into the urlBase', async () => {
      Config.Server.languages = ['en', 'hu'];
      const res = await get('/hu/gallery/' + encodeURIComponent(ALBUM));
      res.should.have.status(302);
      expect(res.header['location']).to.equal(URL_BASE + '/gallery/' + encodeURIComponent(ALBUM) + '?ln=hu');
    });
  });

  // A proxy that passes the path on as it is (e.g. nginx `location /myGallery { proxy_pass http://pigallery2; }`, see #854).
  describe('behind a proxy that keeps the urlBase', () => {

    // TODO #1254: the server does not answer under the urlBase; remove the rejection check once it does
    it('should answer the app, the API and the assets under the urlBase (expected to fail #1254)', async () => {
      const check = async (): Promise<void> => {
        const page = await get(URL_BASE + '/gallery/' + encodeURIComponent(ALBUM));
        expect(page.status, 'app page').to.equal(200);
        expect(page.text, 'app page').to.contain('<base href="' + URL_BASE + '/"/>');

        const api = await get(URL_BASE + Config.Server.apiPath + '/gallery/content/' + encodeURIComponent(ALBUM));
        expect(api.status, 'api').to.equal(200);
        expect(api.body.result?.directory?.name, 'api').to.equal(ALBUM);

        const asset = await get(URL_BASE + '/assets/logo.png');
        expect(asset.status, 'asset').to.equal(200);
      };
      await check().should.be.rejectedWith(chai.AssertionError, 'app page');
    });
  });
});
