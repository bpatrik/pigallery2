import {Config} from '../../../../common/config/private/Config';
import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import {FileJob} from './FileJob';
import {VideoProcessing} from '../../fileaccess/fileprocessing/VideoProcessing';

declare const global: any;

export class VideoConvertingJob extends FileJob {
  public readonly Name = DefaultsJobs[DefaultsJobs['Video Converting']];

  constructor() {
    super({noPhoto: true, noMetaFile: true});
  }

  public get Supported(): boolean {
    return Config.Media.Video.enabled === true;
  }

  protected async shouldProcess(mPath: string): Promise<boolean> {
    return !(await VideoProcessing.convertedVideoExist(mPath));
  }

  protected async processFile(mPath: string): Promise<void> {
    await VideoProcessing.convertVideo(mPath);
    if (global.gc) {
      global.gc();
    }
  }
}
