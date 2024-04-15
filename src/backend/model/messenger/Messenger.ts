import {MediaDTO, MediaDTOUtils} from '../../../common/entities/MediaDTO';
import {PhotoProcessing} from '../fileaccess/fileprocessing/PhotoProcessing';
import {ProjectPath} from '../../ProjectPath';
import {Config} from '../../../common/config/private/Config';
import {ThumbnailSourceType} from '../fileaccess/PhotoWorker';
import * as path from 'path';
import {Utils} from '../../../common/Utils';
import {QueryParams} from '../../../common/QueryParams';
import {DynamicConfig} from '../../../common/entities/DynamicConfig';

export interface MediaDTOWithThPath extends MediaDTO {
  thumbnailPath: string;
  thumbnailUrl: string;
}

export abstract class Messenger<C extends Record<string, unknown> = Record<string, unknown>> {

  public abstract get Name(): string;
  protected config: C;
  public readonly ConfigTemplate: DynamicConfig[]  = [];

  private async getThumbnail(m: MediaDTO) {
    return await PhotoProcessing.generateThumbnail(
      path.join(ProjectPath.ImageFolder, m.directory.path, m.directory.name, m.name),
      Config.Media.Photo.thumbnailSizes[0],
      MediaDTOUtils.isPhoto(m) ? ThumbnailSourceType.Photo : ThumbnailSourceType.Video,
      false
    );
  }


  public async send(config: C, input: string | MediaDTO[] | unknown) {
    if (Array.isArray(input) && input.length > 0
      && (input as MediaDTO[])[0]?.name
      && (input as MediaDTO[])[0]?.directory
      && (input as MediaDTO[])[0]?.metadata?.creationDate) {
      const media = input as MediaDTOWithThPath[];
      for (let i = 0; i < media.length; ++i) {
        media[i].thumbnailPath = await this.getThumbnail(media[i]);
        media[i].thumbnailUrl = Utils.concatUrls(Config.Server.publicUrl, '/gallery/', encodeURIComponent(path.join(media[i].directory.path, media[i].directory.name))) +
          '?' + QueryParams.gallery.photo + '=' + encodeURIComponent(media[i].name);
      }
      return await this.sendMedia(config, media);
    }
    // TODO: implement other branches
    throw new Error('Not yet implemented');
  }

  protected abstract sendMedia(config: C, media: MediaDTOWithThPath[]): Promise<void> ;
}
