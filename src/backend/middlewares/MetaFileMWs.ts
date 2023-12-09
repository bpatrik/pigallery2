import {NextFunction, Request, Response} from 'express';
import * as fs from 'fs';
import {Config} from '../../common/config/private/Config';
import {GPXProcessing} from '../model/fileaccess/fileprocessing/GPXProcessing';
import {Logger} from '../Logger';

const LOG_TAG = 'MetaFileMWs';

export class MetaFileMWs {
  public static async compressGPX(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    if (!req.resultPipe) {
      return next();
    }
    // if conversion is not enabled redirect, so browser can cache the full
    if (Config.MetaFile.GPXCompressing.enabled === false) {
      return res.redirect(req.originalUrl.slice(0, -1 * '\\bestFit'.length));
    }
    const fullPath = req.resultPipe as string;
    try {
      const compressedGPX = GPXProcessing.generateConvertedPath(
          fullPath,
      );

      // check if converted photo exist
      if (fs.existsSync(compressedGPX) === true) {
        req.resultPipe = compressedGPX;
        return next();
      }

      if (Config.MetaFile.GPXCompressing.onTheFly === true) {
        req.resultPipe = await GPXProcessing.compressGPX(fullPath);
        return next();
      }
    } catch (err) {
      // Graceful degradation if compression fails
      Logger.warn(LOG_TAG, 'Error during compressingGPX, using original file: ' + fullPath);
      return res.redirect(req.originalUrl.slice(0, -1 * '\\bestFit'.length));
    }
    // not converted and won't be now
    return res.redirect(req.originalUrl.slice(0, -1 * '\\bestFit'.length));
  }
}

