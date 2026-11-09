import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {JobManager} from '../../../../../src/backend/model/jobs/JobManager';
import {JobRepository} from '../../../../../src/backend/model/jobs/JobRepository';
import {Job} from '../../../../../src/backend/model/jobs/jobs/Job';
import {FileJob} from '../../../../../src/backend/model/jobs/jobs/FileJob';
import {IndexingJob} from '../../../../../src/backend/model/jobs/jobs/IndexingJob';
import {DefaultsJobs} from '../../../../../src/common/entities/job/JobDTO';
import {JobProgressDTO, JobProgressStates} from '../../../../../src/common/entities/job/JobProgressDTO';
import {DynamicConfig} from '../../../../../src/common/entities/DynamicConfig';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Config} from '../../../../../src/common/config/private/Config';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import {TestHelper} from '../../../../TestHelper';

declare const describe: any;
declare const before: any;
declare const after: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;

// processes `items` items, one per step
class CountingJob extends Job<{ items: number }> {
  public readonly Name = 'Counting test job #1315';
  public readonly ConfigTemplate: DynamicConfig[] = [];
  private left = 0;

  public get Supported(): boolean {
    return true;
  }

  protected async init(): Promise<void> {
    this.left = this.config.items;
    this.Progress.All = this.left;
  }

  protected async step(): Promise<boolean> {
    if (this.left === 0) {
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 2));
    this.left--;
    this.Progress.Processed++;
    this.Progress.Left = this.left;
    return true;
  }
}

// a file job that can't process one of the files (e.g. a broken photo or an ffmpeg crash)
class BrokenFileJob extends FileJob {
  public readonly Name = 'Broken file test job #1315';
  public readonly processed: string[] = [];

  constructor() {
    super({noMetaFile: true, noVideo: true});
  }

  public get Supported(): boolean {
    return true;
  }

  protected async shouldProcess(): Promise<boolean> {
    return true;
  }

  protected async processFile(filePath: string): Promise<void> {
    if (path.basename(filePath) === 'broken.jpg') {
      throw new Error('Unsupported image');
    }
    this.processed.push(path.basename(filePath));
  }
}

describe('JobManager (#1315)', () => {
  before(TestHelper.resetConfig);

  const imageDir = path.join(TestHelper.TMP_DIR, 'job_images');
  const countingJob = new CountingJob();
  const brokenFileJob = new BrokenFileJob();
  let jobManager: JobManager;

  const waitForJob = async (name: string): Promise<void> => {
    const job = JobRepository.Instance.getAvailableJobs().find(j => j.Name === name)!;
    const start = Date.now();
    while (job.InProgress && Date.now() - start < 10000) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    expect(job.InProgress, name + ' should finish').to.be.false;
  };
  const progressOf = (name: string): JobProgressDTO =>
    Object.values(jobManager.getProgresses()).find(p => p.jobName === name)!;

  before(() => {
    JobRepository.Instance.register(countingJob);
    JobRepository.Instance.register(brokenFileJob);
  });

  after(() => {
    delete JobRepository.Instance.availableJobs[countingJob.Name];
    delete JobRepository.Instance.availableJobs[brokenFileJob.Name];
  });

  beforeEach(async () => {
    TestHelper.resetConfig();
    fs.rmSync(TestHelper.TMP_DIR, {recursive: true, force: true});
    fs.mkdirSync(imageDir, {recursive: true});
    Config.Database.dbFolder = TestHelper.TMP_DIR;
    Config.Media.folder = imageDir;
    Config.Jobs.scheduled = [];
    ProjectPath.reset();
    jobManager = new JobManager();
    await jobManager.init();
  });

  afterEach(async () => {
    await jobManager.cleanUp();
    await ObjectManagers.reset();
    fs.rmSync(TestHelper.TMP_DIR, {recursive: true, force: true});
  });

  it('should run a job and report its progress until it finishes', async () => {
    await jobManager.run(countingJob.Name, {items: 20}, true, false);
    expect(countingJob.InProgress).to.be.true;
    expect(progressOf(countingJob.Name).state).to.equal(JobProgressStates.running);

    await waitForJob(countingJob.Name);
    const progress = progressOf(countingJob.Name);
    expect(progress.state).to.equal(JobProgressStates.finished);
    expect(progress.steps.all).to.equal(20);
    expect(progress.steps.processed).to.equal(20);
  });

  it('should stop a running job', async () => {
    await jobManager.run(countingJob.Name, {items: 100000}, true, false);
    jobManager.stop(countingJob.Name);
    await waitForJob(countingJob.Name);
    const progress = progressOf(countingJob.Name);
    expect(progress.state).to.equal(JobProgressStates.canceled);
    expect(progress.steps.processed).to.be.lessThan(100000);
  });

  it('should not start a second job while one is running', async () => {
    await jobManager.run(countingJob.Name, {items: 100000}, true, false);
    try {
      await jobManager.run(brokenFileJob.Name, {indexedOnly: false}, true, false);
      expect.fail('should not start');
    } catch (e) {
      expect((e as Error).message).to.contain('another is running');
    } finally {
      jobManager.stop(countingJob.Name);
      await waitForJob(countingJob.Name);
    }
    expect(brokenFileJob.InProgress).to.be.false;
  });

  it('should process the other files when one file fails and log the failed one', async () => {
    for (const name of ['Tihany.jpg', 'broken.jpg', 'Hévíz.jpg']) {
      fs.writeFileSync(path.join(imageDir, name), '');
    }
    await jobManager.run(brokenFileJob.Name, {indexedOnly: false}, true, false);
    await waitForJob(brokenFileJob.Name);

    expect(brokenFileJob.processed.sort()).to.deep.equal(['Hévíz.jpg', 'Tihany.jpg']);
    const progress = progressOf(brokenFileJob.Name);
    expect(progress.state).to.equal(JobProgressStates.finished);
    expect(progress.logs.map(l => l.comment).join('\n')).to.match(/Error during processing file:.*broken\.jpg.*Unsupported image/);
  });

  it('should index the other folders when indexing a folder fails and log the failed one', async () => {
    const indexed: string[] = [];
    const om = ObjectManagers.getInstance() as unknown as Record<string, unknown>;
    om['IndexingManager'] = {
      IsSavingInProgress: false,
      indexDirectory: async (dir: string) => {
        const name = path.basename(dir) || '.';
        if (name === 'unreadable') {
          throw new Error('EACCES: permission denied');
        }
        indexed.push(name);
        return {
          directories: name === '.' ? ['Balaton', 'unreadable', 'Hévíz'].map(n => ({path: '/', name: n})) : []
        };
      }
    };
    for (const name of ['Balaton', 'unreadable', 'Hévíz']) {
      fs.mkdirSync(path.join(imageDir, name));
    }
    const indexingName = DefaultsJobs[DefaultsJobs.Indexing];
    expect(JobRepository.Instance.getAvailableJobs().find(j => j.Name === indexingName)).to.be.instanceOf(IndexingJob);

    await jobManager.run(indexingName, {indexChangesOnly: false}, true, false);
    await waitForJob(indexingName);

    expect(indexed.sort()).to.deep.equal(['.', 'Balaton', 'Hévíz'].sort());
    const progress = progressOf(indexingName);
    expect(progress.state).to.equal(JobProgressStates.finished);
    expect(progress.logs.map(l => l.comment).join('\n')).to.contain('Indexing failed for: /unreadable');
  });
});
