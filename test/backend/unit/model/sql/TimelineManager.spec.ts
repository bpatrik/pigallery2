import {expect} from 'chai';
import * as path from 'path';
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
import {GalleryRestJob} from '../../../../../src/backend/model/jobs/jobs/GalleryResetJob';
import {JobProgress} from '../../../../../src/backend/model/jobs/jobs/JobProgress';
import {
  ANDSearchQuery,
  DatePatternFrequency,
  DatePatternSearch,
  SearchQueryTypes,
  TextSearch,
} from '../../../../../src/common/entities/SearchQueryDTO';

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
    const lastMsOfMonth = TestHelper.getBasePhotoEntry(directory, 'last-ms-of-month.jpg');
    lastMsOfMonth.metadata.creationDate = Date.UTC(2017, 0, 31, 23, 59, 59, 999);
    lastMsOfMonth.metadata.creationDateOffset = '+00:00';
    const offsetCrossesMonth = TestHelper.getBasePhotoEntry(directory, 'offset-crosses-month.jpg');
    offsetCrossesMonth.metadata.creationDate = Date.UTC(2017, 1, 28, 23, 30);
    offsetCrossesMonth.metadata.creationDateOffset = '+01:00';
    const preEpochMonthEnd = TestHelper.getBasePhotoEntry(directory, 'pre-epoch-month-end.jpg');
    preEpochMonthEnd.metadata.creationDate = Date.UTC(1960, 0, 31, 23, 59, 59, 999);
    preEpochMonthEnd.metadata.creationDateOffset = '+00:00';
    await DBTestHelper.persistTestDir(directory);
    const connection = await SQLConnection.getConnection();
    const otherDirectory = await connection
      .getRepository(DirectoryEntity)
      .save(TestHelper.getDirectoryEntry(null, 'timeline-other'));
    const otherPhoto = TestHelper.getBasePhotoEntry(otherDirectory, 'other.jpg');
    otherPhoto.metadata.creationDate = Date.UTC(2016, 0, 1);
    await connection.getRepository(PhotoEntity).save(otherPhoto);
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

  it('applies directory-level projection to pages and summary counts', async () => {
    const session = {
      user: {projectionKey: 'timeline-test-directory-projection'},
      projectionQuery: new Brackets(qb =>
        qb.where('directory.name = :allowedDirectory', {allowedDirectory: 'timeline-other'})
      ),
    } as any;

    const page = await manager.getMediaPage(session, {limit: 10});
    const summary = await manager.getSummary(session);
    expect(page.media.map(item => item.name)).to.deep.equal(['other.jpg']);
    expect(summary).to.deep.equal({years: [{year: 2016, months: [{month: 1, count: 1}]}]});
  });

  it('attaches a permitted companion video and hides it from the listing', async () => {
    Config.Media.LivePhoto.enabled = true;
    const items: MediaDTO[] = [];
    let cursor: {from: number; after: number} | undefined;
    for (let request = 0; request < 10; request++) {
      const page = await manager.getMediaPage(DBTestHelper.defaultSession, {limit: 2, cursor});
      items.push(...page.media);
      if (!page.next) {
        break;
      }
      cursor = page.next;
    }

    const names = items.map(item => item.name);
    expect(names).to.include('live.jpg');
    expect(names).to.include('standalone.mp4');
    expect(names).to.not.include('companion.mp4');
    const live = items.find(item => item.name === 'live.jpg')!;
    expect(live.liveVideoPath).to.equal(
      path.join(live.directory.path, live.directory.name, 'companion.mp4')
    );
    expect(live.liveVideoInfo.name).to.equal('companion.mp4');
    expect(items.every(item => !item.metadata.contentIdentifier)).to.be.true;
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

  it('summary counts equal a full traversal grouped by month, near day and month boundaries', async () => {
    Config.Media.LivePhoto.enabled = true;
    for (const ignoreTimestampOffset of [true, false]) {
      Config.Gallery.ignoreTimestampOffset = ignoreTimestampOffset;
      const items: MediaDTO[] = [];
      let cursor: {from: number; after: number} | undefined;
      for (let request = 0; request < 20; request++) {
        const page = await manager.getMediaPage(DBTestHelper.defaultSession, {limit: 3, cursor});
        items.push(...page.media);
        if (!page.next) {
          break;
        }
        cursor = page.next;
      }
      const expected: Record<string, number> = {};
      for (const item of items) {
        const date = new Date(getTimelineEffectiveTime(item, ignoreTimestampOffset));
        const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
        expected[key] = (expected[key] || 0) + 1;
      }
      const actual: Record<string, number> = {};
      for (const year of (await manager.getSummary(DBTestHelper.defaultSession)).years) {
        for (const month of year.months) {
          actual[`${year.year}-${month.month}`] = month.count;
        }
      }

      expect(actual, `ignoreTimestampOffset=${ignoreTimestampOffset}`).to.deep.equal(expected);
      expect(actual['1960-1']).to.equal(1);
      expect(actual['2017-1']).to.equal(1);
      expect(actual[ignoreTimestampOffset ? '2017-3' : '2017-2']).to.equal(1);
    }
  });

  it('detects date-relative projections and does not cache their summary', async () => {
    const keyword = {type: SearchQueryTypes.keyword, value: 'x'} as TextSearch;
    const daysAgo = {type: SearchQueryTypes.date_pattern, frequency: DatePatternFrequency.days_ago, agoNumber: 3} as DatePatternSearch;
    expect(SessionManager.isTimeDependent(keyword)).to.be.false;
    expect(SessionManager.isTimeDependent({type: SearchQueryTypes.AND, list: [keyword, daysAgo]} as ANDSearchQuery)).to.be.true;

    const stable = {user: {projectionKey: 'timeline-stable'}, projectionQuery: null} as any;
    const relative = {user: {projectionKey: 'timeline-relative'}, projectionQuery: null, hasTimeDependentProjection: true} as any;
    expect(await manager.getSummary(stable)).to.equal(await manager.getSummary(stable));
    const first = await manager.getSummary(relative);
    const second = await manager.getSummary(relative);
    expect(second).to.not.equal(first);
    expect(second).to.deep.equal(first);
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

  // keep last: deletes the fixture
  it('drops the cached summary and changes the data version after a gallery reset', async () => {
    const versionBefore = await ObjectManagers.getInstance().VersionManager.getDataVersion();
    const before = await manager.getSummary(DBTestHelper.defaultSession);
    expect(before.years).to.not.be.empty;

    const job = new GalleryRestJob();
    (job as any).progress = new JobProgress(job.Name, job.Name, '[test]');
    await (job as any).step();

    expect(await manager.getSummary(DBTestHelper.defaultSession)).to.deep.equal({years: []});
    expect((await manager.getMediaPage(DBTestHelper.defaultSession, {limit: 10})).media).to.be.empty;
    expect(await ObjectManagers.getInstance().VersionManager.getDataVersion()).to.not.equal(versionBefore);
  });
});