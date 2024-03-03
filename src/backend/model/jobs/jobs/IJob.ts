import {JobDTO} from '../../../../common/entities/job/JobDTO';
import {JobProgress} from './JobProgress';
import {IJobListener} from './IJobListener';

export interface IJob<T extends Record<string, unknown> = Record<string, unknown>> extends JobDTO {
  Name: string;
  Supported: boolean;
  Progress: JobProgress;
  JobListener: IJobListener;
  InProgress: boolean;
  allowParallelRun: boolean;

  start(config: T, soloRun: boolean, allowParallelRun: boolean): Promise<void>;

  cancel(): void;

  toJSON(): JobDTO;
}
