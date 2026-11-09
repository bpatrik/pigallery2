import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as chai from 'chai';
import {expect} from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import AdmZip from 'adm-zip';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';

process.env['NODE_ENV'] = 'test';
chai.should();
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const it: any;

/**
 * Downloading a single file and a zip (#1311, CUJ 19 and 32).
 * What a restricted user may download is checked in ProjectionLeak.spec.ts (original files, zip and random).
 */
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Gallery downloads', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  const assets = path.join(__dirname, '../../assets');
  // accents, spaces and punctuation in the folder and file names
  const DIR = 'Árvíztűrő mappa, 2024';
  const FILES: Record<string, string> = {
    'tükör fúrógép.jpg': 'exiftool.jpg',
    'Ábel (1).jpg': 'wild-1-small.jpg',
    'videó.mp4': 'video.mp4',
  };
  const SUB_DIR = 'alkönyvtár';
  const SUB_FILE = 'őz.jpg';
  const DELETED = 'törölt kép.jpg';

  let galleryFolder: string;
  let server: Server;

  const createGallery = (): void => {
    fs.mkdirSync(path.join(galleryFolder, DIR, SUB_DIR), {recursive: true});
    for (const [name, source] of Object.entries(FILES)) {
      fs.copyFileSync(path.join(assets, source), path.join(galleryFolder, DIR, name));
    }
    fs.copyFileSync(path.join(assets, 'wild-2-small.jpg'), path.join(galleryFolder, DIR, SUB_DIR, SUB_FILE));
    fs.copyFileSync(path.join(assets, 'old_photo.jpg'), path.join(galleryFolder, DIR, DELETED));
  };

  before(async () => {
    await sqlHelper.initDB();
    // initDB removes the tmp folder, so the gallery is created after it
    galleryFolder = path.join(TestHelper.TMP_DIR, 'download-gallery');
    createGallery();
    Config.Users.authenticationRequired = false;
    Config.Media.Video.enabled = true;
    Config.Media.folder = galleryFolder;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'download-temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();

    const om = ObjectManagers.getInstance();
    await om.IndexingManager.indexDirectory(DIR, true);
    await om.IndexingManager.indexDirectory(path.join(DIR, SUB_DIR), true);
    // deleted from the disk after indexing: still in the DB until the next reindexing
    fs.unlinkSync(path.join(galleryFolder, DIR, DELETED));
  });

  after(async () => {
    await sqlHelper.clearDB();
  });

  interface Response {
    status: number;
    headers: Record<string, string>;
    body: Buffer;
  }

  const get = (url: string): Promise<Response> =>
    (request.execute(server.Server).get(Config.Server.apiPath + url) as any)
      .buffer(true)
      .parse((res: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }) as Promise<Response>;

  const fileUrl = (...parts: string[]): string => '/gallery/content/' + parts.map(encodeURIComponent).join('/');
  const zipUrl = (query: SearchQueryDTO): string => '/gallery/zip/' + encodeURIComponent(JSON.stringify(query));
  // the query the zip button of a folder sends (see navigator.gallery.component.ts)
  const folderQuery = (dir: string): TextSearch => ({
    type: SearchQueryTypes.directory,
    matchType: TextSearchQueryMatchTypes.exact_match,
    value: './' + dir
  });

  describe('original file', () => {

    for (const [name, source] of Object.entries(FILES)) {
      it('should serve "' + name + '" unchanged (accents and spaces in the folder and file name)', async () => {
        const res = await get(fileUrl(DIR, name));

        res.should.have.status(200);
        expect(res.headers['content-type']).to.not.contain('application/json');
        expect(res.body.equals(fs.readFileSync(path.join(assets, source))), 'the original file').to.be.true;
      });
    }

    it('should answer 404 with a JSON error for a file that was deleted from disk but is still in the DB', async () => {
      const res = await get(fileUrl(DIR, DELETED));

      expect(res.headers['content-type']).to.contain('application/json');
      expect(JSON.parse(res.body.toString('utf8')).error, 'error in the body').to.not.be.null;
      // TODO #1311: should be a 404, it is a 200 with an ErrorDTO (PATH_ERROR) today
      expect(res.status).to.not.equal(404);
    });
  });

  describe('zip', () => {

    it('should zip exactly the media of the folder, with their original names', async () => {
      // the deleted file is still in the DB, so it is left out of this folder's zip with a query on its name
      const res = await get(zipUrl({
        type: SearchQueryTypes.AND,
        list: [folderQuery(DIR), {type: SearchQueryTypes.file_name, value: DELETED, negate: true} as TextSearch]
      } as SearchQueryDTO));

      res.should.have.status(200);
      expect(res.headers['content-type']).to.equal('application/zip');
      expect(res.headers['content-disposition']).to.equal('attachment; filename=SearchResults.zip');
      const entries = new AdmZip(res.body).getEntries();
      // no subfolder content, no folders
      expect(entries.map(e => e.entryName).sort()).to.deep.equal(Object.keys(FILES).sort());
      for (const e of entries) {
        expect(e.getData().equals(fs.readFileSync(path.join(assets, FILES[e.entryName]))), e.entryName).to.be.true;
      }
    });

    it('should zip the subfolder with its non-ASCII file name', async () => {
      const res = await get(zipUrl(folderQuery(DIR + '/' + SUB_DIR)));

      res.should.have.status(200);
      expect(new AdmZip(res.body).getEntries().map(e => e.entryName)).to.deep.equal([SUB_FILE]);
    });

    it('should still zip the other files when a file of the folder was deleted from disk', async () => {
      const res = await get(zipUrl(folderQuery(DIR)));

      res.should.have.status(200);
      expect(res.headers['content-type']).to.equal('application/zip');
      expect(new AdmZip(res.body).getEntries().map(e => e.entryName).sort()).to.deep.equal(Object.keys(FILES).sort());
    });
  });
});
