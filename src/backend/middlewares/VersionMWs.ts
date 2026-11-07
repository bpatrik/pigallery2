import {NextFunction, Request, Response} from 'express';
import {ObjectManagers} from '../model/ObjectManagers';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {CustomHeaders} from '../../common/CustomHeaders';
import {Config} from '../../common/config/private/Config';
import * as crypto from 'node:crypto';

export class VersionMWs {
  /**
   * This version data is mainly used to trigger page reload on the client side
   */
  public static injectAppVersion(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      const clientConfigStr = JSON.stringify(Config.getClientConfig());
      const hash = crypto.createHash('md5').update(Config.Environment.upTime + clientConfigStr).digest('hex');
      res.header(
        CustomHeaders.appVersion,
        hash
      );
      next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Can not get app version',
          String(err)
        )
      );
    }
  }

  /**
   * This version data is mainly used on the client side to invalidate the cache
   */
  public static async injectGalleryVersion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // DB version from the client perspective depends on the projection and if the DB was updated
      const version = await ObjectManagers.getInstance().VersionManager.getDataVersion();
      const projectionKey = 'pr:' + (req.session.context?.user?.projectionKey ?? '');
      res.header(
        CustomHeaders.dataVersion,
        version + projectionKey
      );
      next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Can not get data version',
          String(err)
        )
      );
    }
  }
}
