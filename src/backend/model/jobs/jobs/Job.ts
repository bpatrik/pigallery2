import {Logger} from '../../../Logger';
import {IJob} from './IJob';
import {JobDTO, JobDTOUtils} from '../../../../common/entities/job/JobDTO';
import {JobProgress} from './JobProgress';
import {IJobListener} from './IJobListener';
import {JobProgressStates} from '../../../../common/entities/job/JobProgressDTO';
import {DynamicConfig} from '../../../../common/entities/DynamicConfig';

declare const process: { nextTick: (_: unknown) => void };
declare const global: { gc: () => void };

const LOG_TAG = '[JOB]';

export abstract class Job<T extends Record<string, unknown> = Record<string, unknown>> implements IJob<T> {
  public allowParallelRun: boolean = null;
  protected progress: JobProgress = null;
  protected config: T;
  protected prResolve: () => void;
  protected IsInstant = false;
  private jobListener: IJobListener;
  private soloRun: boolean;

  public set JobListener(value: IJobListener) {
    this.jobListener = value;
  }

  public abstract get Supported(): boolean;

  public abstract get Name(): string;

  public abstract get ConfigTemplate(): DynamicConfig[];

  public get Progress(): JobProgress {
    return this.progress;
  }

  public get InProgress(): boolean {
    return (
      this.Progress !== null &&
      (this.Progress.State === JobProgressStates.running ||
        this.Progress.State === JobProgressStates.cancelling)
    );
  }

  public start(
    config: T,
    soloRun = false,
    allowParallelRun = false
  ): Promise<void> {
    if (this.InProgress === false && this.Supported === true) {
      Logger.info(
        LOG_TAG,
        'Running job ' + (soloRun === true ? 'solo' : '') + ': ' + this.Name
      );
      this.soloRun = soloRun;
      this.allowParallelRun = allowParallelRun;
      this.config = {} as T;
      if (this.ConfigTemplate) {
        this.ConfigTemplate.forEach(ct => (this.config as Record<string, unknown>)[ct.id] = ct.defaultValue);
      }
      if (config) {
        for (const key of Object.keys(config)) {
          (this.config as Record<string, unknown>)[key] = config[key];
        }
      }
      this.progress = new JobProgress(
        this.Name,
        JobDTOUtils.getHashName(this.Name, this.config)
      );
      this.progress.OnChange = this.jobListener.onProgressUpdate;
      const pr = new Promise<void>((resolve): void => {
        this.prResolve = resolve;
      });
      this.init().catch(console.error);
      this.run();
      if (!this.IsInstant) {
        // if instant, wait for execution, otherwise, return right away
        return Promise.resolve();
      }
      return pr;
    } else {
      Logger.info(
        LOG_TAG,
        'Job already running or not supported: ' + this.Name
      );
      return Promise.reject(
        'Job already running or not supported: ' + this.Name
      );
    }
  }

  public cancel(): void {
    if (this.InProgress === false) {
      return;
    }
    Logger.info(LOG_TAG, 'Stopping job: ' + this.Name);
    this.Progress.State = JobProgressStates.cancelling;
  }

  public toJSON(): JobDTO {
    return {
      Name: this.Name,
      ConfigTemplate: this.ConfigTemplate,
    };
  }

  /**
   * Returns with true if more steps are left or false if no more
   * @protected
   */
  protected abstract step(): Promise<boolean>;

  protected abstract init(): Promise<void>;

  private onFinish(): void {
    if (this.InProgress === false) {
      return;
    }
    if (this.Progress.State === JobProgressStates.running) {
      this.Progress.State = JobProgressStates.finished;
    } else if (this.Progress.State === JobProgressStates.cancelling) {
      this.Progress.State = JobProgressStates.canceled;
    }

    const finishState = this.Progress.State;
    this.progress = null;
    if (global.gc) {
      global.gc();
    }
    Logger.info(LOG_TAG, 'Job finished: ' + this.Name);
    if (this.IsInstant) {
      this.prResolve();
    }
    this.jobListener.onJobFinished(this, finishState, this.soloRun);
  }

  private run(): void {
    // we call setImmediate later.
    process.nextTick(async (): Promise<void> => {
      try {
        if (
          this.Progress == null ||
          this.Progress.State !== JobProgressStates.running
        ) {
          this.onFinish();
          return;
        }
        if ((await this.step()) === false) {
          // finished
          this.onFinish();
          return;
        }
        // giving back the control to the main event loop (Macrotask queue)
        // https://blog.insiderattack.net/promises-next-ticks-and-immediates-nodejs-event-loop-part-3-9226cbe7a6aa
        await new Promise(setImmediate);
        this.run();
      } catch (e) {
        Logger.error(LOG_TAG, 'Job failed with:');
        Logger.error(LOG_TAG, e);
        this.Progress.log('Failed with: ' + (typeof e.toString === 'function') ? e.toString() : JSON.stringify(e));
        this.Progress.State = JobProgressStates.failed;
      }
    });
  }
}
