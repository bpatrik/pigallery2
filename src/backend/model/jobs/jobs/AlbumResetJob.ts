import {ObjectManagers} from '../../ObjectManagers';
import {DefaultsJobs,} from '../../../../common/entities/job/JobDTO';
import {Job} from './Job';
import {DynamicConfig} from '../../../../common/entities/DynamicConfig';

export class AlbumRestJob extends Job {
  public readonly Name = DefaultsJobs[DefaultsJobs['Album Reset']];
  public readonly ConfigTemplate: DynamicConfig[] = null;
  protected readonly IsInstant = true;

  public get Supported(): boolean {
    return true;
  }

  protected async init(): Promise<void> {
    // abstract function
  }

  protected async step(): Promise<boolean> {
    this.Progress.Left = 1;
    this.Progress.Processed++;
    await ObjectManagers.getInstance().AlbumManager.deleteAll();
    return false;
  }
}
