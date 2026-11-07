import {ObjectManagers} from '../../ObjectManagers';
import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import {Job} from './Job';
import {DynamicConfig} from '../../../../common/entities/DynamicConfig';

export class AlbumCoverRestJob extends Job {
  public readonly Name = DefaultsJobs[DefaultsJobs['Album Cover Reset']];
  public readonly ConfigTemplate: DynamicConfig[] = [];
  protected override readonly IsInstant = true;


  override get LOG_TAG(): string {
    return '[AlbumCoverRestJob]';
  }

  public get Supported(): boolean {
    return true;
  }

  protected async init(): Promise<void> {
    // abstract function
  }

  protected async step(): Promise<boolean> {
    this.Progress.Left = 1;
    this.Progress.Processed++;
    await ObjectManagers.getInstance().CoverManager.resetCovers();
    await ObjectManagers.getInstance().AlbumManager.invalidateCache();
    await ObjectManagers.getInstance().PersonManager.invalidateCache();
    return false;
  }
}
