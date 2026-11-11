// CUJ 38 (#1315): the photo converting (thumbnail) and video converting jobs write their output to the temp folder
// and report their progress.
import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {JobManager} from '../../../../../src/backend/model/jobs/JobManager';
import {JobRepository} from '../../../../../src/backend/model/jobs/JobRepository';
import {DefaultsJobs} from '../../../../../src/common/entities/job/JobDTO';
import {JobProgressDTO, JobProgressStates} from '../../../../../src/common/entities/job/JobProgressDTO';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Config} from '../../../../../src/common/config/private/Config';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import {PhotoProcessing} from '../../../../../src/backend/model/fileaccess/fileprocessing/PhotoProcessing';
import {VideoProcessing} from '../../../../../src/backend/model/fileaccess/fileprocessing/VideoProcessing';
import {TestHelper} from '../../../../TestHelper';

declare const describe: any;
declare const before: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;

describe('File processing jobs (#1315)', function (this: { timeout(ms: number): void }) {
  this.timeout(60000);
  before(TestHelper.resetConfig);

  const assets = path.join(__dirname, '../../../../backend/assets');
  const imageDir = path.join(TestHelper.TMP_DIR, 'job_images');
  const albumDir = path.join(imageDir, 'summer');
  let jobManager: JobManager;

  const photoConverting = DefaultsJobs[DefaultsJobs['Photo Converting']];
  const videoConverting = DefaultsJobs[DefaultsJobs['Video Converting']];

  const runAndWait = async (name: string, config: Record<string, unknown>): Promise<JobProgressDTO> => {
    const job = JobRepository.Instance.getAvailableJobs().find(j => j.Name === name)!;
    await jobManager.run(name, config, true, false);
    const start = Date.now();
    while (job.InProgress && Date.now() - start < 50000) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(job.InProgress, name + ' should finish').to.be.false;
    return Object.values(jobManager.getProgresses()).find(p => p.jobName === name)!;
  };

  beforeEach(async () => {
    TestHelper.resetConfig();
    fs.rmSync(TestHelper.TMP_DIR, {recursive: true, force: true});
    fs.mkdirSync(albumDir, {recursive: true});
    // accented file name: thumbnails of non-ASCII paths
    fs.copyFileSync(path.join(assets, 'test image öüóőúéáű-.,.jpg'), path.join(imageDir, 'árvíztűrő.jpg'));
    fs.copyFileSync(path.join(assets, 'two_ratings.jpg'), path.join(albumDir, 'beach.jpg'));
    fs.copyFileSync(path.join(assets, 'video.mp4'), path.join(albumDir, 'video.mp4'));
    Config.Database.dbFolder = TestHelper.TMP_DIR;
    Config.Media.folder = imageDir;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'tmp');
    Config.Jobs.scheduled = [];
    ProjectPath.reset();
    // the server does it on start
    PhotoProcessing.init();
    jobManager = new JobManager();
    await jobManager.init();
  });

  afterEach(async () => {
    await jobManager.cleanUp();
    await ObjectManagers.reset();
    fs.rmSync(TestHelper.TMP_DIR, {recursive: true, force: true});
  });

  it('should generate the thumbnails of every photo and video in the temp folder', async () => {
    const size = Config.Media.Photo.thumbnailSizes[0];
    const media = [path.join(imageDir, 'árvíztűrő.jpg'), path.join(albumDir, 'beach.jpg'), path.join(albumDir, 'video.mp4')];
    for (const m of media) {
      expect(fs.existsSync(PhotoProcessing.generateConvertedPath(m, size)), 'no thumbnail before: ' + m).to.be.false;
    }

    const progress = await runAndWait(photoConverting, {sizes: [size], indexedOnly: false});

    expect(progress.state).to.equal(JobProgressStates.finished);
    for (const m of media) {
      const thumbnail = PhotoProcessing.generateConvertedPath(m, size);
      expect(thumbnail.startsWith(ProjectPath.TranscodedFolder), thumbnail).to.be.true;
      expect(fs.statSync(thumbnail).size, 'thumbnail of ' + m).to.be.greaterThan(0);
    }
    expect(progress.steps.processed).to.equal(3);
    expect(progress.steps.skipped).to.equal(0);
    expect(progress.logs.map(l => l.comment).join('\n')).to.contain('beach.jpg');

    // a second run finds them and skips them
    const rerun = await runAndWait(photoConverting, {sizes: [size], indexedOnly: false});
    expect(rerun.state).to.equal(JobProgressStates.finished);
    expect(rerun.steps.processed).to.equal(0);
    expect(rerun.steps.skipped).to.equal(3);
  });

  it('should convert the videos in the temp folder', async () => {
    const video = path.join(albumDir, 'video.mp4');
    const converted = VideoProcessing.generateConvertedFilePath(video);
    expect(fs.existsSync(converted)).to.be.false;

    const progress = await runAndWait(videoConverting, {indexedOnly: false});

    expect(progress.state).to.equal(JobProgressStates.finished);
    expect(converted.startsWith(ProjectPath.TranscodedFolder), converted).to.be.true;
    expect(fs.statSync(converted).size).to.be.greaterThan(0);
    expect(await VideoProcessing.isValidConvertedPath(converted)).to.be.true;
    // only the video, not the photos
    expect(progress.steps.processed).to.equal(1);
    expect(progress.logs.map(l => l.comment).join('\n')).to.not.contain('beach.jpg');
  });
});
