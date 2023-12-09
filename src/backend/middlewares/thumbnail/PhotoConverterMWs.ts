import {NextFunction, Request, Response} from 'express';
import * as fs from 'fs';
import {PhotoProcessing} from '../../model/fileaccess/fileprocessing/PhotoProcessing';
import {Config} from '../../../common/config/private/Config';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';

export class PhotoConverterMWs {
  public static async convertPhoto(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    if (!req.resultPipe) {
      return next();
    }
    // if conversion is not enabled redirect, so browser can cache the full
    if (Config.Media.Photo.Converting.enabled === false) {
      return res.redirect(req.originalUrl.slice(0, -1 * '\\bestFit'.length));
    }
    const fullMediaPath = req.resultPipe as string;

    const convertedVideo = PhotoProcessing.generateConvertedPath(
        fullMediaPath,
        Config.Media.Photo.Converting.resolution
    );

    // check if converted photo exist
    if (fs.existsSync(convertedVideo) === true) {
      req.resultPipe = convertedVideo;
      return next();
    }

    if (Config.Media.Photo.Converting.onTheFly === true) {
      try {
        req.resultPipe = await PhotoProcessing.convertPhoto(fullMediaPath);
      } catch (err) {
        return next(new ErrorDTO(ErrorCodes.PHOTO_GENERATION_ERROR, err.message));
      }
      return next();
    }

    // not converted and won't be now
    return res.redirect(req.originalUrl.slice(0, -1 * '\\bestFit'.length));
  }
}

