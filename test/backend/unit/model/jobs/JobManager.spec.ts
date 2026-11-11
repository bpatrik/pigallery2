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
import {JobScheduleDTO, JobTriggerType} from '../../../../../src/common/entities/job/JobScheduleDTO';

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

  private readonly supported = true;

  public get Supported(): boolean {
    return this.supported;
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

  private readonly supported = true;

  public get Supported(): boolean {
    return this.supported;
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

// a job with a name given in the constructor, that records when it runs
class RecordingJob extends Job<Record<string, unknown>> {
  public readonly ConfigTemplate: DynamicConfig[] = [];
  public runs: string[] = [];

  private readonly supported = true;

  constructor(public readonly Name: string, private readonly log: string[]) {
    super();
  }

  public get Supported(): boolean {
    return this.supported;
  }

  protected async init(): Promise<void> {
    this.log.push(this.Name);
    this.Progress.All = 2;
  }

  protected async step(): Promise<boolean> {
    if (this.Progress.Processed >= 2) {
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 2));
    this.Progress.Processed++;
    return true;
  }
}

/**
 * Jobs run by their schedule (CUJ 38, #1254): at a date, periodically, or after another scheduled job.
 * The tests don't wait for real time: the schedule timers are caught and fired by the test.
 */
describe('JobManager schedules (CUJ 38)', () => {
  before(TestHelper.resetConfig);

  const log: string[] = [];
  const jobA = new RecordingJob('Scheduled test job A #1254', log);
  const jobB = new RecordingJob('Scheduled test job B #1254', log);
  const jobC = new RecordingJob('Scheduled test job C #1254', log);
  let jobManager: JobManager;
  const HOUR = 60 * 60 * 1000;

  const schedule = (name: string, job: IJobName, trigger: JobScheduleDTO['trigger']): JobScheduleDTO => ({
    name,
    jobName: job.Name,
    config: {},
    allowParallelRun: false,
    trigger
  });
  interface IJobName {
    Name: string;
  }

  const waitFor = async (condition: () => boolean, what: string, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    expect(condition(), what).to.be.true;
  };
  // A job that finishes starts the jobs scheduled after it synchronously (Job.onFinish -> JobManager.onJobFinished
  // -> Job.start), so once every job is idle, no other job is about to start.
  const idle = (): boolean => [jobA, jobB, jobC].every(j => !j.InProgress);
  const timerCount = (): number => (jobManager as unknown as { timers: unknown[] }).timers.length;
  // ten minutes from now, in UTC minutes of the day: far enough that a minute rollover during the test
  // doesn't matter, and the timer stays longer than a minute (so it is caught)
  const inTenMinutes = (now: Date): number => (now.getUTCHours() * 60 + now.getUTCMinutes() + 10) % (24 * 60);

  const start = async (scheduled: JobScheduleDTO[]): Promise<void> => {
    Config.Jobs.scheduled = scheduled;
    jobManager = new JobManager();
    await jobManager.init();
  };

  // the timers of the schedules (longer than a minute) are caught, the others (job steps, progress saving) run
  const realSetTimeout = global.setTimeout;
  let caught: { callback: () => void, delay: number }[];

  before(() => {
    for (const j of [jobA, jobB, jobC]) {
      JobRepository.Instance.register(j);
    }
  });

  after(() => {
    for (const j of [jobA, jobB, jobC]) {
      delete JobRepository.Instance.availableJobs[j.Name];
    }
  });

  beforeEach(() => {
    TestHelper.resetConfig();
    fs.rmSync(TestHelper.TMP_DIR, {recursive: true, force: true});
    Config.Database.dbFolder = TestHelper.TMP_DIR;
    ProjectPath.reset();
    log.length = 0;
    caught = [];
    (global as any).setTimeout = (callback: () => void, delay?: number, ...args: unknown[]): NodeJS.Timeout => {
      if ((delay ?? 0) > 60 * 1000) {
        caught.push({callback, delay: delay!});
        // a real timer that never fires during the test, so clearTimeout() works on it
        return realSetTimeout(() => undefined, 2 ** 31 - 1).unref();
      }
      return realSetTimeout(callback, delay, ...args) as unknown as NodeJS.Timeout;
    };
  });

  afterEach(async () => {
    global.setTimeout = realSetTimeout;
    await waitFor(idle, 'jobs should finish');
    await jobManager?.cleanUp();
    Config.Jobs.scheduled = [];
    fs.rmSync(TestHelper.TMP_DIR, {recursive: true, force: true});
  });

  it('should run a job at its scheduled date and not one whose date has passed', async () => {
    const date = Date.now() + HOUR;
    await start([
      schedule('A at a date', jobA, {type: JobTriggerType.scheduled, time: date}),
      schedule('B in the past', jobB, {type: JobTriggerType.scheduled, time: Date.now() - 1000}),
      schedule('C never', jobC, {type: JobTriggerType.never}),
    ]);
    expect(log, 'not before its date').to.deep.equal([]);
    expect(Object.keys(jobManager.getProgresses())).to.deep.equal([]);
    expect(caught.length, 'only A has a timer').to.equal(1);
    expect(Date.now() + caught[0].delay).to.be.closeTo(date, 1000);

    // the date has come
    caught[0].callback();
    await waitFor(idle, 'A should finish');
    expect(log).to.deep.equal([jobA.Name]);
    expect(Object.values(jobManager.getProgresses()).map(p => p.state)).to.deep.equal([JobProgressStates.finished]);
  });

  it('should run the jobs scheduled after a job, in a chain', async () => {
    await start([
      schedule('C after B', jobC, {type: JobTriggerType.after, afterScheduleName: 'B after A'}),
      schedule('B after A', jobB, {type: JobTriggerType.after, afterScheduleName: 'A at a date'}),
      schedule('A at a date', jobA, {type: JobTriggerType.scheduled, time: Date.now() + HOUR}),
    ]);
    expect(caught.length, 'only A has a timer').to.equal(1);

    caught[0].callback();
    await waitFor(() => log.length === 3 && idle(), 'the chain should run');
    expect(log).to.deep.equal([jobA.Name, jobB.Name, jobC.Name]);
  });

  it('should run the jobs scheduled after a job that was started by hand, unless it was a solo run', async () => {
    await start([
      schedule('A', jobA, {type: JobTriggerType.never}),
      schedule('B after A', jobB, {type: JobTriggerType.after, afterScheduleName: 'A'}),
    ]);

    await jobManager.run(jobA.Name, {}, true, false);
    await waitFor(idle, 'A should finish');
    expect(log, 'solo run').to.deep.equal([jobA.Name]);

    await jobManager.run(jobA.Name, {}, false, false);
    await waitFor(() => log.length === 3 && idle(), 'B should run after A');
    expect(log).to.deep.equal([jobA.Name, jobA.Name, jobB.Name]);
  });

  it('should not run the jobs scheduled after a job that was stopped', async () => {
    await start([
      schedule('A', jobA, {type: JobTriggerType.never}),
      schedule('B after A', jobB, {type: JobTriggerType.after, afterScheduleName: 'A'}),
    ]);

    await jobManager.run(jobA.Name, {}, false, false);
    jobManager.stop(jobA.Name);
    await waitFor(idle, 'A should stop');
    expect(log).to.deep.equal([jobA.Name]);
  });

  describe('periodic', () => {
    it('should run a daily job at its time of the day, then schedule the next day', async () => {
      const now = new Date();
      const atTime = inTenMinutes(now);
      const expected = new Date(now);
      expected.setUTCSeconds(0, 0);
      expected.setUTCHours(Math.floor(atTime / 60), atTime % 60);
      if (expected.getTime() <= now.getTime()) {
        expected.setUTCDate(expected.getUTCDate() + 1);
      }

      await start([schedule('A daily', jobA, {type: JobTriggerType.periodic, periodicity: 7, atTime})]);
      expect(caught.length, 'one timer').to.equal(1);
      expect(Date.now() + caught[0].delay).to.be.closeTo(expected.getTime(), 1000);
      expect(Object.values(jobManager.getProgresses()), 'not run yet').to.deep.equal([]);

      // the time has come
      caught[0].callback();
      await waitFor(() => log.length === 1 && idle(), 'A should run');
      // the next run is computed from the clock; the test fired the timer early, so it is the same time again
      await waitFor(() => caught.length === 2, 'the next run should be scheduled');
      expect(Date.now() + caught[1].delay).to.be.closeTo(expected.getTime(), 1000);
      expect(timerCount(), 'one timer').to.equal(1);
    });

    it('should stop the timers on cleanUp', async () => {
      await start([schedule('A daily', jobA, {type: JobTriggerType.periodic, periodicity: 7, atTime: inTenMinutes(new Date())})]);
      expect(caught.length).to.equal(1);
      expect(timerCount()).to.equal(1);
      jobManager.stopSchedules();
      expect(timerCount()).to.equal(0);
    });
  });
});
