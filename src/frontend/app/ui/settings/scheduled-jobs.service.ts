import {Injectable, inject, signal} from '@angular/core';
import {Subject} from 'rxjs';
import {JobProgressDTO, JobProgressStates, OnTimerJobProgressDTO,} from '../../../../common/entities/job/JobProgressDTO';
import {NetworkService} from '../../model/network/network.service';
import {JobScheduleDTO} from '../../../../common/entities/job/JobScheduleDTO';
import {JobDTO, JobDTOUtils, JobStartDTO} from '../../../../common/entities/job/JobDTO';
import {BackendtextService} from '../../model/backendtext.service';
import {NotificationService} from '../../model/notification.service';
import {DynamicConfig} from '../../../../common/entities/DynamicConfig';

@Injectable({providedIn: 'root'})
export class ScheduledJobsService {
  private networkService = inject(NetworkService);
  private notification = inject(NotificationService);
  private backendTextService = inject(BackendtextService);

  public readonly progress = signal<Record<string, OnTimerJobProgressDTO>>({});
  public readonly onJobFinish = new Subject<string>();
  timer: number | null = null;
  public readonly availableJobs = signal<JobDTO[]>([]);
  public readonly availableMessengers = signal<string[]>([]);
  public readonly jobStartingStopping = signal<Record<string, boolean>>({});
  private subscribers = 0;

  public  isValidJob(name: string): boolean {
    return !!this.availableJobs().find(j => j.Name === name);
  }

  private async getAvailableJobs(): Promise<void> {
    this.availableJobs.set(
      await this.networkService.getJson<JobDTO[]>('/admin/jobs/available')
    );
  }

  public async getAvailableMessengers(): Promise<void> {
    this.availableMessengers.set(
      await this.networkService.getJson<string[]>('/admin/messengers/available')
    );
  }

  public getConfigTemplate(JobName: string): DynamicConfig[] | null {
    const job = this.availableJobs().find(
      (t) => t.Name === JobName
    );
    if (job && job.ConfigTemplate && job.ConfigTemplate.length > 0) {
      return job.ConfigTemplate;
    }
    return null;
  }

  public getDefaultConfig(jobName: string): Record<string, unknown> | null {

    const ct = this.getConfigTemplate(jobName);
    if (!ct) {
      return null;
    }
    const config = {} as Record<string, unknown>;
    ct.forEach(c => config[c.id] = c.defaultValue);
    return config;
  }

  getProgress(schedule: JobScheduleDTO): JobProgressDTO {
    return this.progress()[
      JobDTOUtils.getHashName(schedule.jobName, schedule.config)
      ];
  }

  subscribeToProgress(): void {
    this.incSubscribers();
  }

  unsubscribeFromProgress(): void {
    this.decSubscribers();
  }

  public async forceUpdate(): Promise<void> {
    return await this.loadProgress();
  }

  public async start(
    jobName: string,
    config?: Record<string, unknown>,
    soloRun = false,
    allowParallelRun = false
  ): Promise<void> {
    try {
      this.jobStartingStopping.update(m => ({...m, [jobName]: true}));
      await this.networkService.postJson(
        '/admin/jobs/scheduled/' + jobName + '/start',
        {
          config,
          allowParallelRun,
          soloRun,
        } as JobStartDTO
      );
      // placeholder to force showing running job
      this.addDummyProgress(jobName, config);
    } finally {
      this.removeStartingStopping(jobName);
      this.forceUpdate();
    }
  }

  public async stop(jobName: string): Promise<void> {
    this.jobStartingStopping.update(m => ({...m, [jobName]: true}));
    await this.networkService.postJson(
      '/admin/jobs/scheduled/' + jobName + '/stop'
    );
    this.removeStartingStopping(jobName);
    this.forceUpdate();
  }

  protected async loadProgress(): Promise<void> {
    const prevPrg = this.progress();
    const newPrg = await this.networkService.getJson<Record<string, JobProgressDTO>>(
      '/admin/jobs/scheduled/progress'
    );
    this.progress.set(newPrg);
    for (const prg of Object.keys(prevPrg)) {
      if (
        // eslint-disable-next-line no-prototype-builtins
        !newPrg.hasOwnProperty(prg) ||
        // state changed from running to finished
        ((prevPrg[prg].state === JobProgressStates.running ||
            prevPrg[prg].state === JobProgressStates.cancelling) &&
          !(
            newPrg[prg].state === JobProgressStates.running ||
            newPrg[prg].state === JobProgressStates.cancelling
          ))
      ) {
        this.onJobFinish.next(prg);
        // a job that is gone from the new progress (e.g. the placeholder of a quick job) finished
        if (newPrg[prg]?.state === JobProgressStates.failed) {
          this.notification.warning(
            $localize`Job failed` +
            ': ' +
            this.backendTextService.getJobName(prevPrg[prg].jobName)
          );
        } else {
          this.notification.success(
            $localize`Job finished` +
            ': ' +
            this.backendTextService.getJobName(prevPrg[prg].jobName)
          );
        }
      }
    }
  }

  protected isAnyJobRunning(): boolean {
    return Object.values(this.progress())
      .findIndex(p => p.state === JobProgressStates.running ||
        p.state === JobProgressStates.cancelling) !== -1;
  }

  protected getProgressPeriodically(): void {
    if (this.timer != null || this.subscribers === 0) {
      return;
    }
    let repeatTime = 5000;
    if (!this.isAnyJobRunning()) {
      repeatTime = 15000;
    }
    this.timer = window.setTimeout(async () => {
      this.timer = null;
      this.getProgressPeriodically();
    }, repeatTime);
    this.loadProgress().catch(console.error);
  }

  private addDummyProgress(jobName: string, config: Record<string, unknown> | undefined): void {
    const hashName = JobDTOUtils.getHashName(jobName, config);
    this.progress.update(prgs => ({
      ...prgs,
      [hashName]: {
        jobName,
        state: JobProgressStates.running,
        HashName: hashName,
        logs: [],
        steps: {
          skipped: 0,
          processed: 0,
          all: 0,
        },
        time: {
          start: Date.now(),
          end: Date.now(),
        },
      }
    }));
  }

  private removeStartingStopping(jobName: string): void {
    this.jobStartingStopping.update(m => {
      const rest = {...m};
      delete rest[jobName];
      return rest;
    });
  }

  private incSubscribers(): void {
    this.subscribers++;
    // the progress of a job is keyed by its config, so the first subscriber (re)loads the jobs and their default configs
    if (this.subscribers === 1) {
      this.getAvailableJobs().catch(console.error);
    }
    this.getProgressPeriodically();
  }

  private decSubscribers(): void {
    this.subscribers--;
  }
}
