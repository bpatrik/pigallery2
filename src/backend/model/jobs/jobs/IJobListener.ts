import {JobProgress} from './JobProgress';
import {IJob} from './IJob';
import {JobProgressStates} from '../../../../common/entities/job/JobProgressDTO';

export interface IJobListener {
  onJobFinished(
      job: IJob,
      state: JobProgressStates,
      soloRun: boolean
  ): Promise<void>;

  // a property, not a method: Job passes it on as a callback
  onProgressUpdate: (progress: JobProgress) => void;
}
