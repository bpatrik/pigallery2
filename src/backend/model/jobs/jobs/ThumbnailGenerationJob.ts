import {Config} from '../../../../common/config/private/Config';
import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import {FileJob} from './FileJob';
import {PhotoProcessing} from '../../fileaccess/fileprocessing/PhotoProcessing';
import {ThumbnailSourceType} from '../../fileaccess/PhotoWorker';
import {MediaDTOUtils} from '../../../../common/entities/MediaDTO';
import {FileDTO} from '../../../../common/entities/FileDTO';
import {backendTexts} from '../../../../common/BackendTexts';

export class ThumbnailGenerationJob extends FileJob<{
  sizes?: number[];
  indexedOnly?: boolean;
}> {
  public readonly Name = DefaultsJobs[DefaultsJobs['Thumbnail Generation']];

  constructor() {
    super({noMetaFile: true});
    this.ConfigTemplate.push({
      id: 'sizes',
      type: 'number-array',
      name: backendTexts.sizeToGenerate.name,
      description: backendTexts.sizeToGenerate.description,
      defaultValue: [Config.Media.Thumbnail.thumbnailSizes[0]],
    });
  }

  public get Supported(): boolean {
    return true;
  }

  start(
      config: { sizes?: number[]; indexedOnly?: boolean },
      soloRun = false,
      allowParallelRun = false
  ): Promise<void> {
    if (!config || !config.sizes || !Array.isArray(config.sizes) || config.sizes.length === 0) {
      config = config || {};
      config.sizes = this.ConfigTemplate.find(ct => ct.id == 'sizes').defaultValue as number[];
    }
    for (const item of config.sizes) {
      if (Config.Media.Thumbnail.thumbnailSizes.indexOf(item) === -1) {
        throw new Error(
            'unknown thumbnails size: ' +
            item +
            '. Add it to the possible thumbnail sizes.'
        );
      }
    }

    return super.start(config, soloRun, allowParallelRun);
  }

  protected async filterMediaFiles(files: FileDTO[]): Promise<FileDTO[]> {
    return files;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async filterMetaFiles(files: FileDTO[]): Promise<FileDTO[]> {
    return undefined;
  }

  protected async shouldProcess(mPath: string): Promise<boolean> {
    for (const item of this.config.sizes) {
      if (!(await PhotoProcessing.convertedPhotoExist(mPath, item))) {
        return true;
      }
    }
    return false;
  }

  protected async processFile(mPath: string): Promise<void> {
    for (const item of this.config.sizes) {
      await PhotoProcessing.generateThumbnail(
          mPath,
          item,
          MediaDTOUtils.isVideoPath(mPath)
              ? ThumbnailSourceType.Video
              : ThumbnailSourceType.Photo,
          false
      );
    }
  }
}
