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
import {ReIndexingSensitivity} from '../../../../src/common/config/private/PrivateConfig';
import {SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';
import {ContentWrapper, ContentWrapperUtils, PackedContentWrapper} from '../../../../src/common/entities/ContentWrapper';
import {JobRepository} from '../../../../src/backend/model/jobs/JobRepository';
import {DefaultsJobs} from '../../../../src/common/entities/job/JobDTO';
import {ErrorCodes} from '../../../../src/common/entities/Error';

process.env['NODE_ENV'] = 'test';
chai.should();
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const it: any;

/**
 * Photos changed on disk show up (CUJ 4/5, #1254): the photo folder is the source of truth, the DB is only a cache of it.
 * A folder is listed (so it is in the DB), then files and subfolders are added, deleted and renamed on disk.
 * After the reindexing that the config makes happen (the listing itself, or the Indexing job),
 * the listing, the search and the zip show the change.
 */
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Photos changed on disk', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  const assets = path.join(__dirname, '../../assets');
  const DIR = 'Nyaralás 2024';
  const KEPT = 'tükör fúrógép.jpg';
  const DELETED = 'törölt kép.jpg';
  const RENAMED_FROM = 'régi név.jpg';
  const RENAMED_TO = 'új név.jpg';
  const ADDED = 'hozzáadott ő.jpg';
  const SUB_RENAMED_FROM = 'Őszi kirándulás';
  const SUB_RENAMED_TO = 'Téli kirándulás';
  const SUB_FILE = 'falevél.jpg';
  const SUB_DELETED = 'Törlendő mappa';
  const SUB_DELETED_FILE = 'hóember.jpg';
  const SUB_ADDED = 'Új mappa';
  const SUB_ADDED_FILE = 'első ű.jpg';

  let galleryFolder: string;
  let server: Server;
  // indexings the listings started in the background; the test waits for them before it closes the DB
  let indexings: Promise<unknown>[] = [];

  const dirPath = (...p: string[]): string => path.join(galleryFolder, DIR, ...p);

  const createGallery = (): void => {
    fs.rmSync(galleryFolder, {recursive: true, force: true});
    fs.mkdirSync(dirPath(SUB_RENAMED_FROM), {recursive: true});
    fs.mkdirSync(dirPath(SUB_DELETED), {recursive: true});
    fs.copyFileSync(path.join(assets, 'exiftool.jpg'), dirPath(KEPT));
    fs.copyFileSync(path.join(assets, 'old_photo.jpg'), dirPath(DELETED));
    fs.copyFileSync(path.join(assets, 'wild-1-small.jpg'), dirPath(RENAMED_FROM));
    fs.copyFileSync(path.join(assets, 'wild-2-small.jpg'), dirPath(SUB_RENAMED_FROM, SUB_FILE));
    fs.copyFileSync(path.join(assets, 'two_ratings.jpg'), dirPath(SUB_DELETED, SUB_DELETED_FILE));
    // the root is never empty (an empty root stops the indexing)
    fs.copyFileSync(path.join(assets, 'date_issue.jpg'), path.join(galleryFolder, 'gyökér.jpg'));
  };

  /**
   * The changes on disk. The folder of the changes gets a new modification time.
   */
  const changeGallery = (): void => {
    fs.unlinkSync(dirPath(DELETED));
    fs.renameSync(dirPath(RENAMED_FROM), dirPath(RENAMED_TO));
    fs.copyFileSync(path.join(assets, 'Chars.jpg'), dirPath(ADDED));
    fs.renameSync(dirPath(SUB_RENAMED_FROM), dirPath(SUB_RENAMED_TO));
    fs.rmSync(dirPath(SUB_DELETED), {recursive: true});
    fs.mkdirSync(dirPath(SUB_ADDED));
    fs.copyFileSync(path.join(assets, 'Chars_exiftool.jpg'), dirPath(SUB_ADDED, SUB_ADDED_FILE));
    // the listing compares the folder's modification time with the one in the DB (ms):
    // make sure it differs, even on a file system with a coarse time resolution
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(dirPath(), later, later);
  };

  const setUp = async (): Promise<void> => {
    await sqlHelper.initDB();
    // initDB removes the tmp folder, so the gallery is created after it
    galleryFolder = path.join(TestHelper.TMP_DIR, 'changed-gallery');
    createGallery();
    Config.Users.authenticationRequired = false;
    Config.Media.folder = galleryFolder;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'changed-temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();

    const im = ObjectManagers.getInstance().IndexingManager;
    indexings = [];
    const indexDirectory = im.indexDirectory.bind(im);
    im.indexDirectory = (...args: Parameters<typeof im.indexDirectory>) => {
      const indexing = indexDirectory(...args);
      indexings.push(indexing.catch(() => null));
      return indexing;
    };

    // in the DB before the change (a first listing would save in the background)
    await im.indexDirectory('.', true);
    await im.indexDirectory(DIR, true);
    for (const sub of [SUB_RENAMED_FROM, SUB_DELETED]) {
      await im.indexDirectory(path.join(DIR, sub), true);
    }
  };

  const tearDown = async (): Promise<void> => {
    // a background indexing that outlives the test would scan the next test's folder and reopen the closed DB
    // (with MySQL, a reopened connection pool keeps mocha from exiting)
    const im = ObjectManagers.getInstance().IndexingManager;
    await Promise.all(indexings);
    await im.SavingReady;
    await sqlHelper.clearDB();
    // the next initDB() would create the temp folder of this one
    TestHelper.resetConfig();
  };

  const enc = (p: string): string => p.split('/').map(encodeURIComponent).join('/');
  const q = (query: SearchQueryDTO): string => encodeURIComponent(JSON.stringify(query));

  const getJson = async (url: string): Promise<ContentWrapper> => {
    const res = await request.execute(server.Server).get(Config.Server.apiPath + url);
    res.should.have.status(200);
    expect(res.body.error, url).to.equal(null);
    return ContentWrapperUtils.unpack(res.body.result as PackedContentWrapper);
  };

  const list = async (dir: string): Promise<{ media: string[], directories: string[] }> => {
    const cw = await getJson('/gallery/content/' + enc(dir));
    return {
      media: (cw.directory!.media ?? []).map(m => m.name).sort(),
      directories: (cw.directory!.directories ?? []).map(d => d.name).sort()
    };
  };

  const searchFileNames = async (value: string): Promise<string[]> => {
    const cw = await getJson('/search/' + q({type: SearchQueryTypes.file_name, value} as TextSearch));
    return (cw.searchResult!.media ?? []).map(m => m.name).sort();
  };

  const zipEntries = async (dir: string): Promise<string[]> => {
    const res = await (request.execute(server.Server)
      .get(Config.Server.apiPath + '/gallery/zip/' + q({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value: './' + dir
      } as TextSearch)) as any)
      .buffer(true)
      .parse((r: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    res.should.have.status(200);
    expect(res.headers['content-type']).to.equal('application/zip');
    return new AdmZip(res.body as Buffer).getEntries().map(e => e.entryName).sort();
  };

  const BEFORE = {
    media: [DELETED, RENAMED_FROM, KEPT].sort(),
    directories: [SUB_DELETED, SUB_RENAMED_FROM].sort()
  };
  const AFTER = {
    media: [ADDED, RENAMED_TO, KEPT].sort(),
    directories: [SUB_ADDED, SUB_RENAMED_TO].sort()
  };

  const shouldSearchAndZipTheChange = async (): Promise<void> => {
    expect(await searchFileNames(KEPT)).to.deep.equal([KEPT]);
    expect(await searchFileNames(ADDED), 'added file').to.deep.equal([ADDED]);
    expect(await searchFileNames(RENAMED_TO), 'renamed file, new name').to.deep.equal([RENAMED_TO]);
    expect(await searchFileNames(RENAMED_FROM), 'renamed file, old name').to.deep.equal([]);
    expect(await searchFileNames(DELETED), 'deleted file').to.deep.equal([]);
    expect(await searchFileNames(SUB_DELETED_FILE), 'file of the deleted folder').to.deep.equal([]);
    expect(await zipEntries(DIR)).to.deep.equal(AFTER.media);
  };

  const runIndexingJob = async (): Promise<void> => {
    const name = DefaultsJobs[DefaultsJobs.Indexing];
    const res = await request.execute(server.Server)
      .post(Config.Server.apiPath + '/admin/jobs/scheduled/' + name + '/start')
      .send({config: {indexChangesOnly: true}, soloRun: true, allowParallelRun: false});
    res.should.have.status(200);
    expect(res.body.error).to.equal(null);
    const job = JobRepository.Instance.getAvailableJobs().find(j => j.Name === name)!;
    const start = Date.now();
    while (job.InProgress && Date.now() - start < 15000) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(job.InProgress, 'the indexing job should finish').to.be.false;
  };

  describe('reindexing sensitivity low (default)', () => {
    beforeEach(setUp);
    afterEach(tearDown);

    it('should list, search and zip the folder as it is on disk before the change', async () => {
      expect(Config.Indexing.reIndexingSensitivity).to.equal(ReIndexingSensitivity.low);
      expect(await list(DIR)).to.deep.equal(BEFORE);
      expect(await searchFileNames(DELETED)).to.deep.equal([DELETED]);
      expect(await zipEntries(DIR)).to.deep.equal(BEFORE.media);
    });

    it('should show added, deleted and renamed files and folders on the next listing', async () => {
      await list(DIR);
      changeGallery();

      // the folder changed on disk: the listing reindexes it and waits for the save
      expect(await list(DIR)).to.deep.equal(AFTER);
      await shouldSearchAndZipTheChange();
    });

    it('should list a renamed and an added subfolder with their photos', async () => {
      changeGallery();
      await list(DIR);

      expect((await list(DIR + '/' + SUB_RENAMED_TO)).media).to.deep.equal([SUB_FILE]);
      expect((await list(DIR + '/' + SUB_ADDED)).media).to.deep.equal([SUB_ADDED_FILE]);
      // the first listing of a new folder saves it in the background
      await ObjectManagers.getInstance().IndexingManager.SavingReady;
      expect(await searchFileNames(SUB_FILE)).to.deep.equal([SUB_FILE]);
      expect(await searchFileNames(SUB_ADDED_FILE)).to.deep.equal([SUB_ADDED_FILE]);
    });

    it('should answer "directory not found" for a renamed or deleted subfolder', async () => {
      changeGallery();
      for (const gone of [SUB_RENAMED_FROM, SUB_DELETED]) {
        const res = await request.execute(server.Server).get(Config.Server.apiPath + '/gallery/content/' + enc(DIR + '/' + gone));
        res.should.have.status(404);
        expect(res.body.error.code, gone).to.equal(ErrorCodes.DIRECTORY_NOT_FOUND);
      }
    });

    it('should not show a deleted file in the search after the Indexing job', async () => {
      changeGallery();

      await runIndexingJob();
      await shouldSearchAndZipTheChange();
      expect(await searchFileNames(SUB_FILE), 'photo of the renamed folder').to.deep.equal([SUB_FILE]);
      expect(await searchFileNames(SUB_ADDED_FILE), 'photo of the added folder').to.deep.equal([SUB_ADDED_FILE]);
      expect(await list(DIR)).to.deep.equal(AFTER);
    });
  });

  describe('reindexing sensitivity never', () => {
    beforeEach(async () => {
      await setUp();
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.never;
    });
    afterEach(tearDown);

    it('should keep the listing from the DB until the Indexing job runs', async () => {
      changeGallery();
      expect(await list(DIR), 'listing from the DB').to.deep.equal(BEFORE);

      await runIndexingJob();
      expect(await list(DIR)).to.deep.equal(AFTER);
      await shouldSearchAndZipTheChange();
    });
  });

  describe('reindexing sensitivity high', () => {
    beforeEach(async () => {
      await setUp();
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.high;
    });
    afterEach(tearDown);

    // replacing a file does not change the modification time of its folder, only the lazy reindexing picks it up
    it('should pick up a replaced file with the lazy reindexing of the listing', async () => {
      const dimensions = async (): Promise<string> => {
        const cw = await getJson('/gallery/content/' + enc(DIR));
        const m = cw.directory!.media.find(x => x.name === KEPT)!;
        return m.metadata.size.width + 'x' + m.metadata.size.height;
      };
      const before = await dimensions();
      fs.copyFileSync(path.join(assets, 'wild-1-small.jpg'), dirPath(KEPT));

      // the listing answers from the DB and reindexes in the background, so a later listing shows the new photo
      const start = Date.now();
      let after = before;
      while (after === before && Date.now() - start < 10000) {
        await new Promise(resolve => setTimeout(resolve, 50));
        await ObjectManagers.getInstance().IndexingManager.SavingReady;
        after = await dimensions();
      }
      expect(after, 'the replaced photo').to.not.equal(before);
    });
  });
});
