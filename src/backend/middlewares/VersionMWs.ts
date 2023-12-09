import {NextFunction, Request, Response} from 'express';
import {ObjectManagers} from '../model/ObjectManagers';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {CustomHeaders} from '../../common/CustomHeaders';

export class VersionMWs {
  /**
   * This version data is mainly used on the client side to invalidate the cache
   */
  public static async injectGalleryVersion(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    try {
      res.header(
          CustomHeaders.dataVersion,
          await ObjectManagers.getInstance().VersionManager.getDataVersion()
      );
      next();
    } catch (err) {
      return next(
          new ErrorDTO(
              ErrorCodes.GENERAL_ERROR,
              'Can not get data version',
              err.toString()
          )
      );
    }
  }
}
