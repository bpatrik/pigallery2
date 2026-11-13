import {NextFunction, Request, Response} from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {ObjectManagers} from '../model/ObjectManagers';
import {ErrorCodes, ErrorDTO, errorMessage} from '../../common/entities/Error';
import multer = require('multer');
import {RequestParams} from './RequestParams';
import {ProjectPath} from '../ProjectPath';
import {Config} from '../../common/config/private/Config';
import {UploadUtils} from '../../common/UploadUtils';
import {UploadedFile} from '../model/UploadManager';
import {FolderNotWritable} from '../exceptions/FolderNotWritable';

/**
 * Saves each file to the temp folder, so a large file is never held in RAM (a Pi has little of it).
 * A file above Upload.maxFileSizeMB is not saved, only marked as tooLarge: the other files of the request are still uploaded.
 */
class TempFolderStorage implements multer.StorageEngine {
  _handleFile(req: Request, file: Express.Multer.File, cb: (error?: unknown, info?: Partial<UploadedFile>) => void): void {
    // UploadManager rejects it: no need to save it
    if (!UploadUtils.isUploadableExtension(UploadUtils.getExtension(file.originalname), Config.Upload.blockedExtensions)) {
      file.stream.resume();
      return cb(null, {});
    }
    const maxBytes = Config.Upload.maxFileSizeMB * 1024 * 1024;
    const tempFolder = path.join(ProjectPath.TempFolder, 'upload');
    const tempPath = path.join(tempFolder, randomUUID());
    let size = 0;
    const limit = new Transform({
      transform(chunk: Buffer, encoding, done): void {
        size += chunk.length;
        // above the limit the rest is read, but not written anymore
        done(null, size > maxBytes ? undefined : chunk);
      }
    });
    fs.promises.mkdir(tempFolder, {recursive: true})
      .then(() => pipeline(file.stream, limit, fs.createWriteStream(tempPath)))
      .then(async () => {
        if (size > maxBytes) {
          await fs.promises.rm(tempPath, {force: true});
          return cb(null, {size, tooLarge: true});
        }
        cb(null, {path: tempPath, size});
      })
      .catch((err) => fs.promises.rm(tempPath, {force: true}).finally(() => cb(err)));
  }

  _removeFile(req: Request, file: Express.Multer.File, cb: (error: Error | null) => void): void {
    if (!file.path) {
      return cb(null);
    }
    fs.promises.rm(file.path, {force: true}).then(() => cb(null), cb);
  }
}

// browsers send the file name as UTF-8, while multer decodes it as latin1 by default (#1263).
// @types/multer does not know defParamCharset yet, the installed multer does.
const options: multer.Options & { defParamCharset: string } = {storage: new TempFolderStorage(), defParamCharset: 'utf8'};
const upload = multer(options).array('files');

export class UploadMWs {
  public static async upload(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) =>
        upload(req, res, (err: unknown) => err ? reject(err instanceof Error ? err : new Error(errorMessage(err))) : resolve()));
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.UPLOAD_ERROR, errorMessage(err)));
    }

    const files = req.files as UploadedFile[];
    if (!files || files.length === 0) {
      return next(new ErrorDTO(ErrorCodes.UPLOAD_ERROR, 'No files uploaded'));
    }

    try {
      const directory = RequestParams.get(req, 'directory') || '';
      req.resultPipe = await ObjectManagers.getInstance().UploadManager.saveFiles(directory, files);
      return next();
    } catch (e) {
      return next(new ErrorDTO(e instanceof FolderNotWritable ? ErrorCodes.PERMISSION_DENIED : ErrorCodes.UPLOAD_ERROR, errorMessage(e)));
    } finally {
      // the files that were not moved to the gallery (e.g. one that already exists)
      await Promise.all(files.filter((f) => f.path).map((f) => fs.promises.rm(f.path, {force: true})));
    }
  }

}
