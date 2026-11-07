import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'path';
import * as fs from 'fs';
import * as chai from 'chai';
import {expect} from 'chai';
import * as http from 'http';
import {AddressInfo} from 'net';
import AdmZip from 'adm-zip';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {SupportedFormats} from '../../../../src/common/SupportedFormats';
import {SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {SQLConnection} from '../../../../src/backend/model/database/SQLConnection';
import {Utils} from '../../../../src/common/Utils';
import {LoginCredential} from '../../../../src/common/entities/LoginCredential';
import {Logger} from '../../../../src/backend/Logger';

process.env.NODE_ENV = 'test';
chai.should();

/**
 * Pins how the routes match and parse their path params (Express 4), so the Express 5 upgrade (#1291) can show that nothing changed.
 * Every file served from the media folder contains its own relative path, so a response tells which file the URL resolved to.
 */
describe('Routing', () => {
  before(TestHelper.resetConfig);

  const sqlHelper = new DBTestHelper(DatabaseType.sqlite);
  // under test/tmp, which initDB() empties, so the media folder is created after it
  const tmpDir = path.join(TestHelper.TMP_DIR, 'routing');
  const mediaDir = path.join(tmpDir, 'media');
  const assets = path.join(__dirname, '../../assets');

  const ACCENTED = 'Árvíztűrő tükörfúrógép';
  const SPECIAL = '100% kész+más #1';
  const DOTS = 'folder.with.dots';
  const PHOTO_DIR = 'dir.jpg'; // a folder that is named like a photo
  const HIDDEN = '.hidden';

  // real files, needed by the routes that read the content (thumbnails, bestFit)
  const realFiles: Record<string, string> = {
    'photo.jpg': path.join(assets, 'sidecar/no_metadata.jpg'),
    [ACCENTED + '/kép 1.jpg']: path.join(assets, 'sidecar/no_metadata.jpg'),
    [ACCENTED + '/al mappa/kép 2.jpg']: path.join(assets, 'sidecar/no_metadata.jpg'),
    [HIDDEN + '/titkos mappa/kép.jpg']: path.join(assets, 'sidecar/no_metadata.jpg'),
    'video.mp4': path.join(assets, 'sidecar/20240128_105420.mp4'),
    'track.gpx': path.join(__dirname, '../../../../demo/images/SF- LA flight.gpx'),
  };
  // files that contain their own relative path
  const markerFiles = (): string[] => [
    ...SupportedFormats.Photos.map(f => 'formats/f.' + f),
    ...SupportedFormats.Videos.map(f => 'formats/f.' + f),
    ...SupportedFormats.MetaFiles.map(f => 'formats/f.' + f),
    ...SupportedFormats.Photos.map(f => 'upper/F.' + f.toUpperCase()),
    ...SupportedFormats.Videos.map(f => 'upper/F.' + f.toUpperCase()),
    'formats/f.txt',
    ACCENTED + '/árvíz.png',
    SPECIAL + '/a+b #c 100%.jpg',
    DOTS + '/a.b c.jpg',
    PHOTO_DIR + '/benne.jpg',
    HIDDEN + '/titkos mappa/rejtett.png',
  ];

  let server: Server;
  let port: number;

  interface Res {
    path: string;
    status: number;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
    text: string;
    json: any;
  }

  /**
   * Sends the path as it is. (superagent would resolve the %2E%2E segments before sending them.)
   */
  const call = (method: string, urlPath: string, headers: http.OutgoingHttpHeaders = {}, body?: Buffer | string): Promise<Res> =>
    new Promise((resolve, reject) => {
      const req = http.request({host: '127.0.0.1', port, method, path: urlPath, headers, agent: false}, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString('utf8');
          let json = null;
          if ((res.headers['content-type'] || '').includes('json')) {
            json = JSON.parse(text);
          }
          resolve({path: urlPath, status: res.statusCode, headers: res.headers, body: buf, text, json});
        });
      });
      req.on('error', reject);
      if (body) {
        req.write(body);
      }
      req.end();
    });

  const get = (urlPath: string, headers: http.OutgoingHttpHeaders = {}): Promise<Res> => call('GET', urlPath, headers);

  const postJson = (urlPath: string, data: unknown, headers: http.OutgoingHttpHeaders = {}): Promise<Res> =>
    call('POST', urlPath, {...headers, 'Content-Type': 'application/json'}, JSON.stringify(data));

  const setUpMedia = (): void => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
    for (const [rel, src] of Object.entries(realFiles)) {
      fs.mkdirSync(path.dirname(path.join(mediaDir, rel)), {recursive: true});
      fs.copyFileSync(src, path.join(mediaDir, rel));
    }
    for (const rel of markerFiles()) {
      fs.mkdirSync(path.dirname(path.join(mediaDir, rel)), {recursive: true});
      fs.writeFileSync(path.join(mediaDir, rel), rel);
    }
    // outside the media folder, must never be served
    fs.writeFileSync(path.join(tmpDir, 'secret.jpg'), 'top-secret');
    fs.writeFileSync(path.join(tmpDir, 'secret.gpx'), 'top-secret');
  };

  const startServer = async (authenticationRequired: boolean): Promise<void> => {
    await sqlHelper.initDB();
    setUpMedia();
    Config.Users.authenticationRequired = authenticationRequired;
    Config.Media.Video.enabled = true;
    Config.Sharing.enabled = true;
    Config.Upload.enabled = true;
    Config.Media.folder = mediaDir;
    Config.Media.tempFolder = path.join(tmpDir, 'temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();
    await new Promise<void>(resolve => server.Server.listen(0, '127.0.0.1', resolve));
    port = (server.Server.address() as AddressInfo).port;
  };

  const tearDown = async (): Promise<void> => {
    await new Promise<void>(resolve => server.Server.close(() => resolve()));
    await sqlHelper.clearDB();
    // the next initDB() would create the temp folder of this one
    TestHelper.resetConfig();
  };

  const api = (p: string): string => Config.Server.apiPath + p;
  const enc = (p: string): string => p.split('/').map(encodeURIComponent).join('/');

  /**
   * Checks that the url served the marker file `rel` from the media folder.
   */
  const shouldServe = async (url: string, rel: string): Promise<void> => {
    const res = await get(url);
    expect(res.status, url).to.equal(200);
    expect(res.text, url).to.equal(rel);
  };

  const shouldHaveError = (res: Res, code: ErrorCodes, status = 200): void => {
    expect(res.status, res.path).to.equal(status);
    expect(res.json?.error?.code, res.path).to.equal(code);
  };

  const shouldNotLeak = (res: Res): void => {
    expect(res.text, res.path).to.not.contain('top-secret');
  };

  const listDir = async (url: string): Promise<{ name: string, path: string }> => {
    const res = await get(url);
    expect(res.status, url).to.equal(200);
    expect(res.json.error, url).to.equal(null);
    return {name: res.json.result.directory.name, path: res.json.result.directory.path};
  };

  const TRAVERSALS = [
    '..', '..%2Fsecret.jpg', '%2E%2E/secret.jpg', '%2e%2e%2fsecret.jpg', 'formats/..%2F..%2Fsecret.jpg',
    'formats/%2E%2E/%2E%2E/secret.jpg', '..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd',
  ];
  // a separator only on Windows, a plain character in a file name on Linux
  const BACKSLASH_TRAVERSAL = '..%5Csecret.jpg';


  describe('gallery', () => {
    before(async () => {
      await startServer(false);
    });
    after(tearDown);

    describe('directory listing', () => {

      it('should list the root folder', async () => {
        for (const url of [api('/gallery/content/'), api('/gallery/'), api('/gallery//')]) {
          expect(await listDir(url), url).to.deep.equal({name: '.', path: '.' + path.sep});
        }
        // only with the trailing slash
        expect((await get(api('/gallery/content'))).status).to.equal(404);
      });

      it('should list nested folders', async () => {
        expect(await listDir(api('/gallery/content/formats'))).to.deep.equal({name: 'formats', path: '.' + path.sep});
        expect(await listDir(api('/gallery/content/formats/'))).to.deep.equal({name: 'formats', path: '.' + path.sep});
        expect(await listDir(api('/gallery/content/' + enc(ACCENTED + '/al mappa'))))
          .to.deep.equal({name: 'al mappa', path: ACCENTED + path.sep});
      });

      it('should decode non-ASCII, percent-encoded and special names', async () => {
        expect(await listDir(api('/gallery/content/' + enc(ACCENTED)))).to.deep.equal({name: ACCENTED, path: '.' + path.sep});
        // an encoded '/' is a separator too
        expect(await listDir(api('/gallery/content/' + encodeURIComponent(ACCENTED + '/al mappa'))))
          .to.deep.equal({name: 'al mappa', path: ACCENTED + path.sep});
        expect(await listDir(api('/gallery/content/' + encodeURIComponent(SPECIAL)))).to.deep.equal({name: SPECIAL, path: '.' + path.sep});
        expect(await listDir(api('/gallery/content/' + DOTS))).to.deep.equal({name: DOTS, path: '.' + path.sep});
      });

      it('should list a folder that is named like a photo', async () => {
        expect(await listDir(api('/gallery/content/' + PHOTO_DIR))).to.deep.equal({name: PHOTO_DIR, path: '.' + path.sep});
      });

      it('should list a folder under a hidden folder', async () => {
        expect(await listDir(api('/gallery/content/' + enc(HIDDEN + '/titkos mappa'))))
          .to.deep.equal({name: 'titkos mappa', path: HIDDEN + path.sep});
      });

      it('should not find a file or a missing folder', async () => {
        shouldHaveError(await get(api('/gallery/content/formats/f.txt')), ErrorCodes.DIRECTORY_NOT_FOUND, 404);
        shouldHaveError(await get(api('/gallery/content/' + enc('nincs ilyen'))), ErrorCodes.DIRECTORY_NOT_FOUND, 404);
      });

      it('should reject path traversal', async () => {
        for (const t of TRAVERSALS) {
          const res = await get(api('/gallery/content/' + t));
          shouldNotLeak(res);
          shouldHaveError(res, ErrorCodes.INPUT_ERROR);
        }
        shouldNotLeak(await get(api('/gallery/content/' + BACKSLASH_TRAVERSAL)));
        shouldHaveError(await get(api('/gallery/content/..')), ErrorCodes.INPUT_ERROR);
        shouldHaveError(await get(api('/gallery/content/%2E%2E%2F')), ErrorCodes.INPUT_ERROR);
        shouldHaveError(await get(api('/gallery/content/formats/..%2F..%2F')), ErrorCodes.INPUT_ERROR);
      });
    });

    describe('media files', () => {

      it('should serve every photo, video and meta file format', async () => {
        for (const f of [...SupportedFormats.Photos, ...SupportedFormats.Videos, ...SupportedFormats.MetaFiles]) {
          await shouldServe(api('/gallery/content/formats/f.' + f), 'formats/f.' + f);
        }
      });

      it('should match the extension case-insensitively', async () => {
        for (const f of [...SupportedFormats.Photos, ...SupportedFormats.Videos]) {
          await shouldServe(api('/gallery/content/upper/F.' + f.toUpperCase()), 'upper/F.' + f.toUpperCase());
        }
      });

      it('should serve files with non-ASCII, special and dotted names', async () => {
        for (const rel of [ACCENTED + '/árvíz.png', SPECIAL + '/a+b #c 100%.jpg', DOTS + '/a.b c.jpg',
          PHOTO_DIR + '/benne.jpg']) {
          await shouldServe(api('/gallery/content/' + enc(rel)), rel);
          // encoded '/'
          await shouldServe(api('/gallery/content/' + encodeURIComponent(rel)), rel);
        }
      });

      it('should serve files under a hidden folder', async () => {
        const rel = HIDDEN + '/titkos mappa/rejtett.png';
        await shouldServe(api('/gallery/content/' + enc(rel)), rel);
      });

      it('should not serve a not supported format as media', async () => {
        // falls through to the directory listing
        shouldHaveError(await get(api('/gallery/content/formats/f.txt')), ErrorCodes.DIRECTORY_NOT_FOUND, 404);
        shouldHaveError(await get(api('/gallery/content/formats/f.jpgx')), ErrorCodes.DIRECTORY_NOT_FOUND, 404);
      });

      it('should report missing media of every format', async () => {
        for (const f of [...SupportedFormats.Photos, ...SupportedFormats.Videos, ...SupportedFormats.MetaFiles]) {
          shouldHaveError(await get(api('/gallery/content/nincs.' + f)), ErrorCodes.PATH_ERROR);
        }
      });

      it('should reject path traversal', async () => {
        for (const t of TRAVERSALS) {
          for (const action of ['', '/icon', '/240', '/bestFit']) {
            const res = await get(api('/gallery/content/' + t + action));
            shouldNotLeak(res);
            shouldHaveError(res, ErrorCodes.INPUT_ERROR);
          }
        }
        shouldNotLeak(await get(api('/gallery/content/' + BACKSLASH_TRAVERSAL)));
        shouldNotLeak(await get(api('/gallery/content/' + BACKSLASH_TRAVERSAL + '/240')));
        shouldHaveError(await get(api('/gallery/content/..%2Fsecret.jpg')), ErrorCodes.INPUT_ERROR);
        shouldHaveError(await get(api('/gallery/content/%2E%2E/secret.gpx')), ErrorCodes.INPUT_ERROR);
        shouldHaveError(await get(api('/gallery/content/..%2Fsecret.gpx/bestFit')), ErrorCodes.INPUT_ERROR);
      });
    });

    describe('media actions', () => {

      const shouldBeImage = async (url: string): Promise<void> => {
        const res = await get(url);
        expect(res.status, url).to.equal(200);
        expect(res.headers['content-type'], url).to.match(/^image\//);
      };

      it('should get photo icons and thumbnails', async () => {
        for (const rel of ['photo.jpg', ACCENTED + '/kép 1.jpg', ACCENTED + '/al mappa/kép 2.jpg', HIDDEN + '/titkos mappa/kép.jpg']) {
          await shouldBeImage(api('/gallery/content/' + enc(rel) + '/icon'));
          await shouldBeImage(api('/gallery/content/' + enc(rel) + '/240'));
          await shouldBeImage(api('/gallery/content/' + encodeURIComponent(rel) + '/240'));
        }
      });

      it('should get video icons, thumbnails and bestFit', async () => {
        await shouldBeImage(api('/gallery/content/video.mp4/icon'));
        await shouldBeImage(api('/gallery/content/video.mp4/240'));
        const res = await get(api('/gallery/content/video.mp4/bestFit'));
        expect(res.status).to.equal(200);
        expect(res.headers['content-type']).to.match(/^video\//);
      });

      it('should get the bestFit meta file', async () => {
        const res = await get(api('/gallery/content/track.gpx/bestFit'));
        expect(res.status).to.equal(200);
        expect(res.text).to.contain('<gpx');
      });

      it('should route the actions of every format', async () => {
        // a missing file reaches loadFile of the matching route
        for (const f of [...SupportedFormats.Photos, ...SupportedFormats.Videos]) {
          shouldHaveError(await get(api('/gallery/content/nincs.' + f + '/icon')), ErrorCodes.PATH_ERROR);
          shouldHaveError(await get(api('/gallery/content/nincs.' + f + '/240')), ErrorCodes.PATH_ERROR);
          shouldHaveError(await get(api('/gallery/content/nincs.' + f.toUpperCase() + '/240')), ErrorCodes.PATH_ERROR);
        }
        for (const f of [...SupportedFormats.Videos, ...SupportedFormats.MetaFiles]) {
          shouldHaveError(await get(api('/gallery/content/nincs.' + f + '/bestFit')), ErrorCodes.PATH_ERROR);
        }
      });

      it('should not route actions of other files', async () => {
        shouldHaveError(await get(api('/gallery/content/nincs.txt/icon')), ErrorCodes.DIRECTORY_NOT_FOUND, 404);
        shouldHaveError(await get(api('/gallery/content/nincs.gpx/240')), ErrorCodes.DIRECTORY_NOT_FOUND, 404);
      });
    });

    describe('search, autocomplete and zip', () => {
      before(async () => {
        // index the folders
        for (const dir of ['', ACCENTED, ACCENTED + '/al mappa', SPECIAL, DOTS, PHOTO_DIR, 'formats']) {
          await listDir(api('/gallery/content/' + enc(dir)));
        }
      });

      const dirQuery = (value: string): TextSearch => ({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value
      } as TextSearch);

      const search = async (url: string): Promise<string[]> => {
        const res = await get(url);
        expect(res.status, url).to.equal(200);
        expect(res.json.error, url).to.equal(null);
        return res.json.result.searchResult.media.map((m: { n: string }) => m.n).sort();
      };

      it('should search with an encoded query', async () => {
        expect(await search(api('/search/' + encodeURIComponent(JSON.stringify(dirQuery(SPECIAL))))))
          .to.deep.equal(['a+b #c 100%.jpg']);
        expect(await search(api('/search/' + encodeURIComponent(JSON.stringify(dirQuery(ACCENTED + '/al mappa'))))))
          .to.deep.equal(['kép 2.jpg']);
      });

      it('should search with a query that has a not encoded "/"', async () => {
        const q = encodeURIComponent(JSON.stringify(dirQuery(ACCENTED + '/al mappa'))).replace(/%2F/g, '/');
        expect(q).to.contain('/');
        expect(await search(api('/search/' + q))).to.deep.equal(['kép 2.jpg']);
      });

      it('should autocomplete', async () => {
        const autocomplete = async (url: string): Promise<string[]> => {
          const res = await get(url);
          expect(res.status, url).to.equal(200);
          expect(res.json.error, url).to.equal(null);
          return res.json.result.map((i: { value: string }) => i.value);
        };
        expect(await autocomplete(api('/autocomplete/' + encodeURIComponent('Árvíz')))).to.contain(ACCENTED);
        expect(await autocomplete(api('/autocomplete/' + encodeURIComponent('100% k')))).to.contain(SPECIAL);
        // a not encoded '/' is part of the value
        expect((await get(api('/autocomplete/al/mappa'))).json.error).to.equal(null);
      });

      it('should zip a search result', async () => {
        const zip = async (q: SearchQueryDTO): Promise<string[]> => {
          const res = await get(api('/gallery/zip/' + encodeURIComponent(JSON.stringify(q))));
          expect(res.status).to.equal(200);
          return new AdmZip(res.body).getEntries().map(e => e.entryName).sort();
        };
        expect(await zip(dirQuery(SPECIAL))).to.deep.equal(['a+b #c 100%.jpg']);
        expect(await zip(dirQuery(ACCENTED + '/al mappa'))).to.deep.equal(['kép 2.jpg']);
      });
    });
  });

  describe('sharing and upload', () => {
    const adminUser: UserDTO = {id: 1, name: 'admin', password: 'admin', role: UserRoles.Admin};
    let cookie: string[];

    before(async () => {
      await startServer(true);
      await ObjectManagers.getInstance().UserManager.createUser(Utils.clone(adminUser));
      await SQLConnection.close();
      const res = await postJson(api('/user/login'),
        {loginCredential: {username: adminUser.name, password: adminUser.password, rememberMe: false} as LoginCredential});
      cookie = res.headers['set-cookie'];
    });
    after(tearDown);

    const createSharing = (dir: string): Promise<Res> =>
      postJson(api('/share/' + dir), {createSharing: {valid: 60 * 1000}}, {Cookie: cookie});

    const sharedDirectory = async (dir: string): Promise<string> => {
      const res = await createSharing(dir);
      expect(res.status, dir).to.equal(200);
      expect(res.json.error, dir).to.equal(null);
      return res.json.result.directoryQuery.value;
    };

    it('should share folders', async () => {
      expect(await sharedDirectory('')).to.equal(path.sep);
      expect(await sharedDirectory('/')).to.equal(path.sep);
      expect(await sharedDirectory('formats')).to.equal('formats');
      expect(await sharedDirectory(enc(ACCENTED + '/al mappa'))).to.equal(path.join(ACCENTED, 'al mappa'));
      expect(await sharedDirectory(encodeURIComponent(ACCENTED + '/al mappa'))).to.equal(path.join(ACCENTED, 'al mappa'));
      expect(await sharedDirectory(encodeURIComponent(SPECIAL))).to.equal(SPECIAL);
      expect(await sharedDirectory(DOTS)).to.equal(DOTS);
      expect(await sharedDirectory(PHOTO_DIR)).to.equal(PHOTO_DIR);
      expect(await sharedDirectory(enc(HIDDEN + '/titkos mappa'))).to.equal(path.join(HIDDEN, 'titkos mappa'));
    });

    it('should reject path traversal on sharing', async () => {
      const before = (await ObjectManagers.getInstance().SharingManager.listAll()).length;
      for (const t of TRAVERSALS) {
        shouldHaveError(await createSharing(t), ErrorCodes.INPUT_ERROR);
        shouldHaveError(await call('PUT', api('/share/' + t), {Cookie: cookie, 'Content-Type': 'application/json'},
          JSON.stringify({updateSharing: {id: 1, valid: 60 * 1000}})), ErrorCodes.INPUT_ERROR);
      }
      expect((await ObjectManagers.getInstance().SharingManager.listAll()).length).to.equal(before);
    });

    const upload = (dir: string): Promise<Res> => {
      const boundary = 'routing-test-boundary';
      const body = Buffer.concat([
        Buffer.from('--' + boundary + '\r\n' +
          'Content-Disposition: form-data; name="files"; filename="feltöltés.jpg"\r\n' +
          'Content-Type: image/jpeg\r\n\r\n', 'utf8'),
        Buffer.from('feltöltött', 'utf8'),
        Buffer.from('\r\n--' + boundary + '--\r\n', 'utf8'),
      ]);
      return call('POST', api('/upload/' + dir), {
        Cookie: cookie,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length
      }, body);
    };

    it('should upload to folders', async () => {
      for (const [dir, rel] of [
        ['', ''], ['/', ''], ['formats', 'formats'], [enc(ACCENTED + '/al mappa'), ACCENTED + '/al mappa'],
        [encodeURIComponent(ACCENTED + '/al mappa'), ACCENTED + '/al mappa'], [encodeURIComponent(SPECIAL), SPECIAL],
        [DOTS, DOTS], [PHOTO_DIR, PHOTO_DIR], [enc(HIDDEN + '/titkos mappa'), HIDDEN + '/titkos mappa']]) {
        const target = path.join(mediaDir, rel, 'feltöltés.jpg');
        fs.rmSync(target, {force: true});
        const res = await upload(dir);
        expect(res.status, dir).to.equal(200);
        expect(res.json.error, dir).to.equal(null);
        expect(fs.existsSync(target), dir).to.be.true;
      }
    });

    it('should reject path traversal on upload', async () => {
      for (const t of TRAVERSALS) {
        const res = await upload(t);
        expect(res.json.error?.code, t).to.equal(ErrorCodes.INPUT_ERROR);
      }
      for (const dir of [tmpDir, path.dirname(tmpDir), path.dirname(path.dirname(tmpDir))]) {
        expect(fs.existsSync(path.join(dir, 'feltöltés.jpg')), dir).to.be.false;
      }
    });
  });

  describe('public pages', () => {
    let frontendFolder: string;
    before(async () => {
      await startServer(false);
      frontendFolder = ProjectPath.FrontendFolder;
      ProjectPath.FrontendFolder = path.join(tmpDir, 'frontend');
      fs.mkdirSync(path.join(ProjectPath.FrontendFolder, 'en', 'assets', 'al mappa'), {recursive: true});
      fs.writeFileSync(path.join(ProjectPath.FrontendFolder, 'en', 'index.html'), '<!-- index -->');
      fs.writeFileSync(path.join(ProjectPath.FrontendFolder, 'en', 'assets', 'al mappa', 'kép.png'), 'assets/al mappa/kép.png');
      fs.writeFileSync(path.join(ProjectPath.FrontendFolder, 'en', 'assets', 'top.png'), 'assets/top.png');
    });
    after(async () => {
      ProjectPath.FrontendFolder = frontendFolder;
      await tearDown();
    });

    it('should render the app for the gallery and search pages', async () => {
      for (const url of ['/gallery', '/gallery/', '/gallery/' + enc(ACCENTED + '/al mappa'), '/gallery/a.jpg',
        '/galleryx', '/search', '/search/' + encodeURIComponent('{"a":"b/c"}'), '/search/a/b?p=c.jpg', '/searchx']) {
        const res = await get(url);
        expect(res.status, url).to.equal(200);
        expect(res.text, url).to.equal('<!-- index -->');
      }
    });

    it('should serve nested and non-ASCII assets', async () => {
      await shouldServe('/assets/top.png', 'assets/top.png');
      await shouldServe('/assets/' + enc('al mappa/kép.png'), 'assets/al mappa/kép.png');
      await shouldServe('/assets/' + encodeURIComponent('al mappa/kép.png'), 'assets/al mappa/kép.png');
      expect((await get('/assets/nincs.png')).status).to.equal(404);
      expect((await get('/assets/')).status).to.equal(404);
    });

    it('should redirect language links with a nested path', async () => {
      Config.Server.languages = ['en', 'hu'];
      const res = await get('/hu/gallery/' + enc(ACCENTED + '/al mappa'));
      expect(res.status).to.equal(302);
      expect(res.headers['location']).to.equal('/gallery/' + enc(ACCENTED + '/al mappa') + '?ln=hu');
    });
  });

  describe('logging and errors', () => {
    const logged: Record<string, string[]> = {silly: [], debug: [], verbose: []};
    const original = {silly: Logger.silly, debug: Logger.debug, verbose: Logger.verbose};

    before(async () => {
      await startServer(false);
      for (const level of Object.keys(logged) as (keyof typeof original)[]) {
        Logger[level] = (...args: unknown[]) => {
          logged[level].push(args[1] as string);
        };
      }
    });
    after(async () => {
      Object.assign(Logger, original);
      await tearDown();
    });
    beforeEach(() => {
      for (const l of Object.values(logged)) {
        l.length = 0;
      }
    });

    const loggedAs = async (url: string): Promise<string[]> => {
      await get(url);
      return Object.keys(logged).filter(l => logged[l].includes(url));
    };

    it('should log api requests as verbose', async () => {
      expect(await loggedAs(api('/gallery/content/'))).to.deep.equal(['verbose']);
      expect(await loggedAs(api('/nincs/ilyen'))).to.deep.equal(['verbose']);
      expect(await loggedAs(api('x'))).to.deep.equal(['verbose']);
    });

    it('should log node_modules requests as silly', async () => {
      expect(await loggedAs('/node_modules/a/b.js')).to.deep.equal(['silly']);
      expect(await loggedAs('/node_modulesx')).to.deep.equal(['silly']);
    });

    it('should log other requests as debug', async () => {
      expect(await loggedAs('/icon.svg')).to.deep.equal(['debug']);
    });

    it('should not find unknown api paths', async () => {
      const res = await get(api('/nincs/ilyen'));
      expect(res.status).to.equal(404);
    });

    it('should render api errors as json', async () => {
      shouldHaveError(await get(api('/gallery/content/nincs.jpg')), ErrorCodes.PATH_ERROR);
    });
  });
});
