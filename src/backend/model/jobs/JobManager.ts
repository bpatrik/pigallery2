import {JobProgressStates, OnTimerJobProgressDTO,} from '../../../common/entities/job/JobProgressDTO';
import {IJob} from './jobs/IJob';
import {JobRepository} from './JobRepository';
import {Config} from '../../../common/config/private/Config';
import {AfterJobTrigger, JobScheduleDTO, JobScheduleDTOUtils, JobTriggerType,} from '../../../common/entities/job/JobScheduleDTO';
import {Logger} from '../../Logger';
import {NotificationManager} from '../NotifocationManager';
import {IJobListener} from './jobs/IJobListener';
import {JobProgress} from './jobs/JobProgress';
import {JobProgressManager} from './JobProgressManager';
import {JobDTOUtils} from '../../../common/entities/job/JobDTO';
import {Utils} from '../../../common/Utils';
import {IObjectManager} from '../database/IObjectManager';

const LOG_TAG = '[JobManager]';

export class JobManager implements IJobListener, IObjectManager {
  protected timers: { schedule: JobScheduleDTO; timer: NodeJS.Timeout }[] = [];
  protected progressManager: JobProgressManager = null;

  async init(){
    this.progressManager = new JobProgressManager();
    this.runSchedules();
  }

  protected get JobRunning(): boolean {
    return (
      JobRepository.Instance.getAvailableJobs().findIndex(
        (j): boolean => j.InProgress === true
      ) !== -1
    );
  }

  protected get JobNoParallelRunning(): boolean {
    return (
      JobRepository.Instance.getAvailableJobs().findIndex(
        (j): boolean => j.InProgress === true && j.allowParallelRun
      ) !== -1
    );
  }

  public getProgresses(): { [id: string]: OnTimerJobProgressDTO } {
    const prg = Utils.clone(this.progressManager.Progresses);
    this.timers.forEach(t => {
      if (!prg[JobDTOUtils.getHashName(t.schedule.jobName, t.schedule.config)]) {
        return;
      }
      (prg[JobDTOUtils.getHashName(t.schedule.jobName, t.schedule.config)] as OnTimerJobProgressDTO).onTimer = true;
    });
    return prg;
  }

  public async run<T extends Record<string, unknown>>(
    jobName: string,
    config: T,
    soloRun: boolean,
    allowParallelRun: boolean
  ): Promise<void> {
    if (
      (allowParallelRun === false && this.JobRunning === true) ||
      this.JobNoParallelRunning === true
    ) {
      throw new Error('Can\'t start this job while another is running');
    }

    const t = this.findJob(jobName);
    if (t) {
      t.JobListener = this;
      await t.start(config, soloRun, allowParallelRun);
    } else {
      Logger.warn(LOG_TAG, 'cannot find job to start:' + jobName);
    }
  }

  public stop(jobName: string): void {
    const t = this.findJob(jobName);
    if (t) {
      t.cancel();
    } else {
      Logger.warn(LOG_TAG, 'cannot find job to stop:' + jobName);
    }
  }

  public onProgressUpdate = (progress: JobProgress): void => {
    this.progressManager.onJobProgressUpdate(progress.toDTO());
  };

  onJobFinished = async (
    job: IJob,
    state: JobProgressStates,
    soloRun: boolean
  ): Promise<void> => {
    // if it was not finished peacefully or was a soloRun, do not start the next one
    if (state !== JobProgressStates.finished || soloRun === true) {
      return;
    }
    const sch = Config.Jobs.scheduled.find(
      (s): boolean => s.jobName === job.Name
    );
    if (sch) {
      const children = Config.Jobs.scheduled.filter(
        (s): boolean =>
          s.trigger.type === JobTriggerType.after &&
          (s.trigger as AfterJobTrigger).afterScheduleName === sch.name
      );
      for (const item of children) {
        try {
          await this.run(
            item.jobName,
            item.config,
            false,
            item.allowParallelRun
          );
        } catch (e) {
          NotificationManager.warning(
            'Job running error:' + item.name,
            e.toString()
          );
        }
      }
    }
  };

  getAvailableJobs(): IJob[] {
    return JobRepository.Instance.getAvailableJobs();
  }

  public async cleanUp() {
    this.stopSchedules();
  }

  public stopSchedules(): void {
    Logger.silly(LOG_TAG, 'Stopping all schedules');
    this.timers.forEach((t): void => clearTimeout(t.timer));
    this.timers = [];
  }

  /**
   * Schedules all jobs to run
   */
  public runSchedules(): void {
    this.stopSchedules();
    Logger.info(LOG_TAG, 'Running job schedules');
    Config.Jobs.scheduled.forEach((s): void => this.runSchedule(s));
  }

  protected findJob(jobName: string): IJob {
    return this.getAvailableJobs().find((t): boolean => t.Name === jobName);
  }

  /**
   * Schedules a single job to run
   */
  private runSchedule(schedule: JobScheduleDTO): void {
    const nextDate = JobScheduleDTOUtils.getNextRunningDate(
      new Date(),
      schedule
    );
    if (nextDate && nextDate.getTime() > Date.now()) {
      Logger.debug(
        LOG_TAG,
        'running schedule: ' +
        schedule.jobName +
        ' at ' +
        nextDate.toLocaleString(undefined, {hour12: false})
      );

      const timer: NodeJS.Timeout = setTimeout(async (): Promise<void> => {
        this.timers = this.timers.filter((t): boolean => t.timer !== timer);
        await this.run(
          schedule.jobName,
          schedule.config,
          false,
          schedule.allowParallelRun
        );
        this.runSchedule(schedule);
      }, nextDate.getTime() - Date.now());
      this.timers.push({schedule, timer});
    } else {
      Logger.debug(LOG_TAG, 'skipping schedule:' + schedule.jobName);
    }
  }
}
