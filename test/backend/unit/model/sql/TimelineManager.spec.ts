import {expect} from 'chai';
import {Brackets} from 'typeorm';
import {Config} from '../../../../../src/common/config/private/Config';
import {DatabaseType} from '../../../../../src/common/config/private/PrivateConfig';
import {MediaDTO} from '../../../../../src/common/entities/MediaDTO';
import {getTimelineEffectiveTime} from '../../../../../src/backend/model/timeline/TimelinePaging';
import {TimelineManager} from '../../../../../src/backend/model/timeline/TimelineManager';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {MediaEntity} from '../../../../../src/backend/model/database/enitites/MediaEntity';
import {PhotoEntity} from '../../../../../src/backend/model/database/enitites/PhotoEntity';
import {DirectoryEntity} from '../../../../../src/backend/model/database/enitites/DirectoryEntity';
import {TestHelper} from '../../../../TestHelper';
import {DBTestHelper} from '../../../DBTestHelper';
import {SessionManager} from '../../../../../src/backend/model/database/SessionManager';

declare let describe: any;
declare const before: any;
declare const after: any;

const originalDescribe = describe;
describe = DBTestHelper.describe();

describe('TimelineManager', (sqlHelper: DBTestHelper) => {
  describe = originalDescribe;

  let manager: TimelineManager;

  before(async () => {
    await sqlHelper.initDB();
    Config.Media.Video.enabled = true;
    Config.Media.LivePhoto.enabled = false;
    Config.Gallery.ignoreTimestampOffset = true;

    const directory = TestHelper.getDirectoryEntry(null, 'timeline-test');
    const base = Date.UTC(2015, 5, 1, 12);
    const first = TestHelper.getBasePhotoEntry(directory, 'first.jpg');
    first.metadata.creationDate = base;
    first.metadata.creationDateOffset = '+02:00';
    const tied = TestHelper.getBasePhotoEntry(directory, 'tied.jpg');
    tied.metadata.creationDate = base;
    tied.metadata.creationDateOffset = '+02:00';
    const old = TestHelper.getBasePhotoEntry(directory, 'old.jpg');
    old.metadata.creationDate = -1;
    old.metadata.creationDateOffset = '-00:30';
    const livePhoto = TestHelper.getBasePhotoEntry(directory, 'live.jpg');
    livePhoto.metadata.creationDate = Date.UTC(2015, 5, 3);
    livePhoto.metadata.contentIdentifier = 'live-pair';
    const companion = TestHelper.getVideoEntry(directory);
    companion.name = 'companion.mp4';
    companion.metadata.creationDate = Date.UTC(2015, 5, 5);
    companion.metadata.contentIdentifier = 'live-pair';
    const standalone = TestHelper.getVideoEntry(directory);
    standalone.name = 'standalone.mp4';
    standalone.metadata.creationDate = Date.UTC(2015, 5, 4);
    await DBTestHelper.persistTestDir(directory);
    await ObjectManagers.getInstance().init();
    manager = ObjectManagers.getInstance().TimelineManager;
  });

  after(async () => {
    await sqlHelper.clearDB();
  });

  beforeEach(() => {
    Config.Media.Video.enabled = true;
    Config.Media.LivePhoto.enabled = false;
    Config.Gallery.ignoreTimestampOffset = true;
  });

  it('traverses every item exactly once in effective-time order', async () => {
    const items: MediaDTO[] = [];
    let cursor: {from: number; after: number} | undefined;
    for (let request = 0; request < 10; request++) {
      const page = await manager.getMediaPage(DBTestHelper.defaultSession, {
        limit: 2,
        cursor,
      });
      items.push(...page.media);
      if (!page.next) {
        break;
      }
      cursor = page.next;
    }

    const expected = await (await SQLConnection.getConnection())
      .getRepository(MediaEntity)
      .find({relations: {directory: true}});
    expected.sort((left, right) =>
      getTimelineEffectiveTime(right, true) - getTimelineEffectiveTime(left, true) ||
      right.id - left.id
    );
    expect(items.map(item => item.id)).to.deep.equal(expected.map(item => item.id));
    expect(new Set(items.map(item => item.id)).size).to.equal(items.length);
  });

  it('applies media-level projection to pages and summary counts', async () => {
    const connection = await SQLConnection.getConnection();
    const allowed = await connection.getRepository(MediaEntity).findOneByOrFail({
      name: 'first.jpg',
    });
    const session = {
      user: {projectionKey: 'timeline-test-projection'},
      projectionQuery: new Brackets(qb =>
        qb.where('media.id = :allowedMediaId', {allowedMediaId: allowed.id})
      ),
    } as any;

    const page = await manager.getMediaPage(session, {limit: 10});
    const summary = await manager.getSummary(session);
    expect(page.media.map(item => item.id)).to.deep.equal([allowed.id]);
    expect(summary.years.flatMap(year => year.months).reduce((sum, month) => sum + month.count, 0)).to.equal(1);
  });

  it('pairs a video whose photo is outside the selected page and respects projection', async () => {
    Config.Media.LivePhoto.enabled = true;
    const connection = await SQLConnection.getConnection();
    const livePhoto = await connection.getRepository(PhotoEntity).findOneByOrFail({
      name: 'live.jpg',
    });
    const companion = await connection.getRepository(MediaEntity).findOneByOrFail({
      name: 'companion.mp4',
    });
    const photoSession = {
      user: {projectionKey: 'timeline-photo-only'},
      projectionQuery: new Brackets(qb =>
        qb.where('media.id = :onlyPhoto', {onlyPhoto: livePhoto.id})
      ),
    } as any;
    const hiddenVideoSession = {
      user: {projectionKey: 'timeline-video-only'},
      projectionQuery: new Brackets(qb =>
        qb.where('media.id = :onlyVideo', {onlyVideo: companion.id})
      ),
    } as any;

    const photoPage = await manager.getMediaPage(photoSession, {limit: 1});
    const videoPage = await manager.getMediaPage(hiddenVideoSession, {limit: 1});
    expect(photoPage.media[0].liveVideoPath).to.be.undefined;
    expect(videoPage.media.map(item => item.name)).to.deep.equal(['companion.mp4']);

    const boundaryPage = await manager.getMediaPage(DBTestHelper.defaultSession, {
      limit: 1,
      cursor: {
        from: Date.UTC(2015, 5, 5),
        after: companion.id + 1,
      },
    });
    expect(boundaryPage.media).to.be.empty;
    expect(boundaryPage.next).to.deep.equal({
      from: Date.UTC(2015, 5, 5),
      after: companion.id,
    });
  });

  it('excludes videos when video support is disabled', async () => {
    Config.Media.Video.enabled = false;
    const page = await manager.getMediaPage(DBTestHelper.defaultSession, {limit: 20});
    expect(page.media.every(item => !item.name.endsWith('.mp4'))).to.be.true;
  });

  it('counts logical items by UTC month and shares concurrent summary builds', async () => {
    Config.Media.LivePhoto.enabled = true;
    const first = manager.getSummary(DBTestHelper.defaultSession);
    const second = manager.getSummary(DBTestHelper.defaultSession);
    const [summaryA, summaryB] = await Promise.all([first, second]);
    expect(summaryA).to.equal(summaryB);
    const counts = summaryA.years.flatMap(year =>
      year.months.map(month => ({year: year.year, month: month.month, count: month.count}))
    );
    expect(counts.find(item => item.year === 1969 && item.month === 12)?.count).to.equal(1);
    expect(counts.find(item => item.year === 2015 && item.month === 6)?.count).to.equal(4);

    await manager.onNewDataVersion();
    expect(await manager.getSummary(DBTestHelper.defaultSession)).to.not.equal(summaryA);
  });

  it('scans a dense equal-time burst and records page latency on each DB engine', async () => {
    const connection = await SQLConnection.getConnection();
    const denseDate = Date.UTC(2020, 0, 1);
    const denseDirectory = await connection
      .getRepository(DirectoryEntity)
      .save(TestHelper.getDirectoryEntry(null, 'timeline-dense'));
    const denseCount = 1200;
    const denseRows = Array.from({length: denseCount}, (_, index) => {
      const photo = TestHelper.getBasePhotoEntry(
        denseDirectory,
        `dense-${index}.jpg`
      );
      photo.metadata.creationDate = denseDate;
      photo.metadata.creationDateOffset = '+00:00';
      return photo;
    });
    await connection.getRepository(PhotoEntity).save(denseRows, {chunk: 200});
    const started = process.hrtime.bigint();
    let rowsExamined = 0;
    const page = await manager.getMediaPage(DBTestHelper.defaultSession, {
      limit: 2,
      onRowsScanned: count => { rowsExamined += count; },
    });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    expect(page.media).to.have.length(2);
    console.log(
      `Timeline DB benchmark (${DatabaseType[sqlHelper.dbType]}): ` +
      `${rowsExamined} rows examined, page latency ${elapsedMs.toFixed(2)} ms`
    );
    expect(rowsExamined).to.be.greaterThanOrEqual(denseCount);
    expect(elapsedMs).to.be.greaterThanOrEqual(0);
  });
});