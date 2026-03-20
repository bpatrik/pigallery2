import {NextFunction, Request, Response} from 'express';
import {ObjectManagers} from '../model/ObjectManagers';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({storage}).array('files');

export class UploadMWs {
  public static async upload(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    upload(req, res, async (err: any) => {
      if (err) {
        return next(new ErrorDTO(ErrorCodes.UPLOAD_ERROR, err.message));
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return next(new ErrorDTO(ErrorCodes.UPLOAD_ERROR, 'No files uploaded'));
      }

      try {
        const directory = req.params['directory'] || '';
        req.resultPipe = await ObjectManagers.getInstance().UploadManager.saveFiles(directory, files);
        return next();
      } catch (e) {
        return next(new ErrorDTO(ErrorCodes.UPLOAD_ERROR, e.message || e));
      }
    });
  }

}
