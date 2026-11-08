import {NextFunction, Request, Response} from 'express';
import {ObjectManagers} from '../model/ObjectManagers';
import {ErrorCodes, ErrorDTO, errorMessage} from '../../common/entities/Error';
import multer = require('multer');
import {RequestParams} from './RequestParams';

const storage = multer.memoryStorage();
// browsers send the file name as UTF-8, while multer decodes it as latin1 by default (#1263).
// @types/multer does not know defParamCharset yet, the installed multer does.
const options: multer.Options & { defParamCharset: string } = {storage, defParamCharset: 'utf8'};
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

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return next(new ErrorDTO(ErrorCodes.UPLOAD_ERROR, 'No files uploaded'));
    }

    try {
      const directory = RequestParams.get(req, 'directory') || '';
      req.resultPipe = await ObjectManagers.getInstance().UploadManager.saveFiles(directory, files);
      return next();
    } catch (e) {
      return next(new ErrorDTO(ErrorCodes.UPLOAD_ERROR, errorMessage(e)));
    }
  }

}
