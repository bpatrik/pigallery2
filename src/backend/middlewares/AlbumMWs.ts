import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {ObjectManagers} from '../model/ObjectManagers';
import {Utils} from '../../common/Utils';
import {Config} from '../../common/config/private/Config';
import {RequestParams} from './RequestParams';
import {RequestSession} from './RequestSession';

export class AlbumMWs {
  public static async listAlbums(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Album.enabled === false) {
      return next();
    }
    try {
      req.resultPipe =
        await ObjectManagers.getInstance().AlbumManager.getAll(RequestSession.getContext(req));
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(ErrorCodes.ALBUM_ERROR, 'Error during listing albums', err)
      );
    }
  }

  public static async deleteAlbum(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Album.enabled === false) {
      return next();
    }
    const id = parseInt(RequestParams.get(req, 'id') ?? '', 10);
    if (!Utils.isUInt32(id)) {
      return next();
    }
    try {
      await ObjectManagers.getInstance().AlbumManager.deleteAlbum(id);
      req.resultPipe = 'ok';
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.ALBUM_ERROR,
          'Error during deleting albums',
          err
        )
      );
    }
  }

  public static async createSavedSearch(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Album.enabled === false) {
      return next();
    }
    if (
      typeof req.body === 'undefined' ||
      typeof req.body.name !== 'string' ||
      typeof req.body.searchQuery !== 'object'
    ) {
      return next(
        new ErrorDTO(ErrorCodes.INPUT_ERROR, 'updateSharing filed is missing')
      );
    }
    try {
      await ObjectManagers.getInstance().AlbumManager.addSavedSearch(
        req.body.name,
        req.body.searchQuery
      );
      req.resultPipe = 'ok';
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.ALBUM_ERROR,
          'Error during creating saved search albums',
          err
        )
      );
    }
  }
}


