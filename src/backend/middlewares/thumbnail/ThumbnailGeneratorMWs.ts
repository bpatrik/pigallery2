import * as path from 'path';
import * as fs from 'fs';
import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {ContentWrapper} from '../../../common/entities/ConentWrapper';
import {DirectoryPathDTO, ParentDirectoryDTO, SubDirectoryDTO,} from '../../../common/entities/DirectoryDTO';
import {ProjectPath} from '../../ProjectPath';
import {Config} from '../../../common/config/private/Config';
import {ThumbnailSourceType} from '../../model/fileaccess/PhotoWorker';
import {MediaDTO} from '../../../common/entities/MediaDTO';
import {PhotoProcessing} from '../../model/fileaccess/fileprocessing/PhotoProcessing';
import {ServerTime} from '../ServerTimingMWs';
import {PersonEntry} from '../../model/database/enitites/PersonEntry';

export class ThumbnailGeneratorMWs {
  private static ThumbnailMapEntries =
      Config.Media.Photo.generateThumbnailMapEntries();

  @ServerTime('2.th', 'Thumbnail decoration')
  public static async addThumbnailInformation(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    if (!req.resultPipe) {
      return next();
    }

    try {
      const cw: ContentWrapper = req.resultPipe as ContentWrapper;
      if (cw.notModified === true) {
        return next();
      }

      // regenerate in case the list change since startup
      ThumbnailGeneratorMWs.ThumbnailMapEntries =
          Config.Media.Photo.generateThumbnailMapEntries();
      if (cw.directory) {
        ThumbnailGeneratorMWs.addThInfoTODir(cw.directory);
      }
      if (cw.searchResult && cw.searchResult.media) {
        ThumbnailGeneratorMWs.addThInfoToPhotos(cw.searchResult.media);
      }
    } catch (error) {
      console.error(error);
      return next(
          new ErrorDTO(
              ErrorCodes.SERVER_ERROR,
              'error during postprocessing result (adding thumbnail info)',
              error.toString()
          )
      );
    }

    return next();
  }

  // eslint-disable-next-line @typescript-eslint/typedef, @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
  public static addThumbnailInfoForPersons(
      req: Request,
      res: Response,
      next: NextFunction
  ): void {
    if (!req.resultPipe) {
      return next();
    }

    let erroredItem: PersonEntry = null;
    try {
      const size: number = Config.Media.Photo.personThumbnailSize;

      const persons: PersonEntry[] = req.resultPipe as PersonEntry[];

      for (const item of persons) {
        erroredItem = item;
        if (!item.sampleRegion) {
          item.missingThumbnail = true;
          continue;
        }
        // load parameters
        const mediaPath = path.join(
            ProjectPath.ImageFolder,
            item.sampleRegion.media.directory.path,
            item.sampleRegion.media.directory.name,
            item.sampleRegion.media.name
        );

        // generate thumbnail path
        const thPath = PhotoProcessing.generatePersonThumbnailPath(
            mediaPath,
            item.sampleRegion.media.metadata.faces.find(f => f.name === item.name),
            size
        );

        item.missingThumbnail = !fs.existsSync(thPath);
      }
    } catch (error) {
      return next(
          new ErrorDTO(
              ErrorCodes.SERVER_ERROR,
              `Error during postprocessing result: adding thumbnail info for persons. Failed on: person ${erroredItem?.name}, at ${erroredItem?.sampleRegion?.media?.name} `,
              error.toString()
          )
      );
    }

    return next();
  }

  public static async generatePersonThumbnail(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    if (!req.resultPipe) {
      return next();
    }
    const person: PersonEntry = req.resultPipe as PersonEntry;
    try {
      req.resultPipe = await PhotoProcessing.generatePersonThumbnail(person);
      return next();
    } catch (error) {
      console.error(error);
      return next(
          new ErrorDTO(
              ErrorCodes.THUMBNAIL_GENERATION_ERROR,
              'Error during generating face thumbnail: ' + person.name,
              error.toString()
          )
      );
    }
  }

  public static generateThumbnailFactory(
      sourceType: ThumbnailSourceType
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
      if (!req.resultPipe) {
        return next();
      }

      // load parameters
      const mediaPath = req.resultPipe as string;
      let size: number =
          parseInt(req.params.size, 10) ||
          Config.Media.Photo.thumbnailSizes[0];

      // validate size
      if (Config.Media.Photo.thumbnailSizes.indexOf(size) === -1) {
        size = Config.Media.Photo.thumbnailSizes[0];
      }

      try {
        req.resultPipe = await PhotoProcessing.generateThumbnail(
            mediaPath,
            size,
            sourceType,
            false
        );
        return next();
      } catch (error) {
        return next(
            new ErrorDTO(
                ErrorCodes.THUMBNAIL_GENERATION_ERROR,
                'Error during generating thumbnail: ' + mediaPath,
                error.toString()
            )
        );
      }
    };
  }

  public static generateIconFactory(
      sourceType: ThumbnailSourceType
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
      if (!req.resultPipe) {
        return next();
      }

      // load parameters
      const mediaPath = req.resultPipe as string;
      const size: number = Config.Media.Photo.iconSize;

      try {
        req.resultPipe = await PhotoProcessing.generateThumbnail(
            mediaPath,
            size,
            sourceType,
            true
        );
        return next();
      } catch (error) {
        return next(
            new ErrorDTO(
                ErrorCodes.THUMBNAIL_GENERATION_ERROR,
                'Error during generating thumbnail: ' + mediaPath,
                error.toString()
            )
        );
      }
    };
  }

  private static addThInfoTODir(
      directory: ParentDirectoryDTO | SubDirectoryDTO
  ): void {
    if (typeof directory.media !== 'undefined') {
      ThumbnailGeneratorMWs.addThInfoToPhotos(directory.media, directory);
    }
    if (directory.cover) {
      ThumbnailGeneratorMWs.addThInfoToAPhoto(directory.cover, directory);
    }
  }

  private static addThInfoToPhotos(photos: MediaDTO[], directory?: DirectoryPathDTO): void {
    for (let i = 0; i < photos.length; ++i) {
      this.addThInfoToAPhoto(photos[i], directory ? directory : photos[i].directory);
    }
  }

  private static addThInfoToAPhoto(photo: MediaDTO, directory: DirectoryPathDTO): void {
    const fullMediaPath = path.join(
        ProjectPath.ImageFolder,
        directory.path,
        directory.name,
        photo.name
    );
    for (let i = 0; i < ThumbnailGeneratorMWs.ThumbnailMapEntries.length; ++i) {
      const entry = ThumbnailGeneratorMWs.ThumbnailMapEntries[i];
      const thPath = PhotoProcessing.generateConvertedPath(
          fullMediaPath,
          entry.size
      );
      if (fs.existsSync(thPath) !== true) {
        if (typeof photo.missingThumbnails === 'undefined') {
          photo.missingThumbnails = 0;
        }
        // this is a bitwise operation
        photo.missingThumbnails += entry.bit;
      }
    }
  }
}

