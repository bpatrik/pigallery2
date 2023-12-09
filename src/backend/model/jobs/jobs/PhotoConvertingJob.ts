import {Config} from '../../../../common/config/private/Config';
import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import {FileJob} from './FileJob';
import {PhotoProcessing} from '../../fileaccess/fileprocessing/PhotoProcessing';

export class PhotoConvertingJob extends FileJob {
  public readonly Name = DefaultsJobs[DefaultsJobs['Photo Converting']];

  constructor() {
    super({noVideo: true, noMetaFile: true});
  }

  public get Supported(): boolean {
    return Config.Media.Photo.Converting.enabled === true;
  }

  protected async shouldProcess(mPath: string): Promise<boolean> {
    return !(await PhotoProcessing.convertedPhotoExist(
      mPath,
      Config.Media.Photo.Converting.resolution
    ));
  }

  protected async processFile(mPath: string): Promise<void> {
    await PhotoProcessing.convertPhoto(mPath);
  }
}
