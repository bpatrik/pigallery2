import {JobProgress} from './JobProgress';
import {IJob} from './IJob';
import {JobProgressStates} from '../../../../common/entities/job/JobProgressDTO';

export interface IJobListener {
  onJobFinished(
      job: IJob,
      state: JobProgressStates,
      soloRun: boolean
  ): void;

  onProgressUpdate(progress: JobProgress): void;
}
