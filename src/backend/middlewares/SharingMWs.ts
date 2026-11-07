import {NextFunction, Request, Response} from 'express';
import {CreateSharingDTO, UpdateSharingDTO} from '../../common/entities/SharingDTO';
import {ObjectManagers} from '../model/ObjectManagers';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {Config} from '../../common/config/private/Config';
import {QueryParams} from '../../common/QueryParams';
import {UserRoles} from '../../common/entities/UserDTO';
import {DirectorySearch, SearchQueryDTO, SearchQueryTypes, TextSearchQueryMatchTypes} from '../../common/entities/SearchQueryDTO';
import * as crypto from 'node:crypto';
import {SharingEntity} from '../model/database/enitites/SharingEntity';
import {UserEntity} from '../model/database/enitites/UserEntity';
import {RequestParams} from './RequestParams';
import {RequestSession} from './RequestSession';

export class SharingMWs {
  private static exactDirectoryQuery(directoryName: string): DirectorySearch {
    return {
      type: SearchQueryTypes.directory,
      value: directoryName,
      matchType: TextSearchQueryMatchTypes.exact_match,
      negate: false
    };
  }

  public static async getSharing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (Config.Sharing.enabled === false) {
        return next();
      }
      const sharingKey = RequestParams.getRequired(req, QueryParams.gallery.sharingKey_params);

      req.resultPipe =
        await ObjectManagers.getInstance().SharingManager.findOne(sharingKey);
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error during retrieving sharing link',
          err
        )
      );
    }
  }

  public static async getSharingPublicInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (Config.Sharing.enabled === false) {
        return next();
      }
      const sharingKey = RequestParams.getRequired(req, QueryParams.gallery.sharingKey_params);

      const sharing = await ObjectManagers.getInstance().SharingManager.findOne(sharingKey);
      if (!sharing) {
        throw new Error('Sharing not found: ' + sharingKey);
      }
      req.resultPipe =
        {
          sharingKey: sharing.sharingKey,
          passwordProtected: Config.Sharing.passwordRequired || (typeof sharing.password === 'string' && sharing.password !== '')
        };

      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error during retrieving sharing key',
          err
        )
      );
    }
  }

  public static async createSharing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (Config.Sharing.enabled === false) {
        return next();
      }
      if (
        typeof req.body === 'undefined' ||
        typeof req.body.createSharing === 'undefined'
      ) {
        return next(
          new ErrorDTO(ErrorCodes.INPUT_ERROR, 'createSharing filed is missing')
        );
      }
      const createSharing: CreateSharingDTO = req.body.createSharing;

      if (Config.Sharing.passwordRequired && !createSharing.password) {

        return next(
          new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Password is required.')
        );
      }

      let sharingKey = SharingMWs.generateKey(Config.Sharing.sharingKeyLength);

      // create one not yet used
      while (true) {
        try {
          await ObjectManagers.getInstance().SharingManager.findOne(sharingKey);
          sharingKey = this.generateKey(Config.Sharing.sharingKeyLength);
        } catch {
          break;
        }
      }

      // normalized by AuthenticationMWs.normalizePathParam
      const directoryName = RequestParams.getRequired(req, 'directory');

      const searchQuery = createSharing.searchQuery || null;
      // without any query, the sharing is about the directory (legacy directory sharing)
      const directoryQuery = createSharing.directoryQuery ||
        (!searchQuery ? SharingMWs.exactDirectoryQuery(directoryName) : null);

      // the id is set when the sharing is saved
      const sharing: Omit<SharingEntity, 'id'> = {
        sharingKey,
        searchQuery,
        directoryQuery,
        password: createSharing.password,
        defaultSearchView: null,
        defaultDirectoryView: null,
        creator: RequestSession.getContext(req).user as UserEntity, // only the user id is used
        expires:
          createSharing.valid >= 0 // if === -1 it's forever
            ? Date.now() + createSharing.valid
            : new Date(9999, 0, 1).getTime(), // never expire
        timeStamp: Date.now(),
      };

      if (createSharing.defaultDirectoryView && createSharing.defaultSearchView) {
        return next(
          new ErrorDTO(
            ErrorCodes.INPUT_ERROR,
            'defaultDirectoryView and defaultSearchView cannot be set at the same time'
          )
        );
      }

      if (createSharing.defaultDirectoryView) {
        sharing.defaultDirectoryView = createSharing.defaultDirectoryView;
      }
      if (createSharing.defaultSearchView) {
        sharing.defaultSearchView = createSharing.defaultSearchView;
      }

      req.resultPipe =
        await ObjectManagers.getInstance().SharingManager.createSharing(
          sharing
        );
      return next();
    } catch (err) {
      console.warn(err);
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error during creating sharing link',
          err
        )
      );
    }
  }

  public static async updateSharing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (Config.Sharing.enabled === false) {
        return next();
      }
      if (
        typeof req.body === 'undefined' ||
        typeof req.body.updateSharing === 'undefined'
      ) {
        return next(
          new ErrorDTO(ErrorCodes.INPUT_ERROR, 'updateSharing filed is missing')
        );
      }
      const updateSharing: CreateSharingDTO = req.body.updateSharing;
      if (typeof updateSharing.id !== 'number') {
        throw new Error('Invalid sharing, id is missing');
      }
      // normalized by AuthenticationMWs.normalizePathParam
      const directoryName = RequestParams.getRequired(req, 'directory');

      const searchQuery = updateSharing.searchQuery || null;
      // without any query, the sharing is about the directory (legacy directory sharing)
      const directoryQuery = updateSharing.directoryQuery ||
        (!searchQuery ? SharingMWs.exactDirectoryQuery(directoryName) : null);

      const sharing: UpdateSharingDTO = {
        id: updateSharing.id,
        searchQuery,
        directoryQuery,
        sharingKey: '',
        password:
          updateSharing.password && updateSharing.password !== ''
            ? updateSharing.password
            : null,
        creator: RequestSession.getContext(req).user,
        expires:
          updateSharing.valid >= 0 // if === -1 its forever
            ? Date.now() + updateSharing.valid
            : new Date(9999, 0, 1).getTime(), // never expire
        timeStamp: Date.now(),
      };


      if (updateSharing.defaultDirectoryView && updateSharing.defaultSearchView) {
        return next(
          new ErrorDTO(
            ErrorCodes.INPUT_ERROR,
            'defaultDirectoryView and defaultSearchView cannot be set at the same time'
          )
        );
      }

      if (updateSharing.defaultDirectoryView) {
        sharing.defaultDirectoryView = updateSharing.defaultDirectoryView;
      }
      if (updateSharing.defaultSearchView) {
        sharing.defaultSearchView = updateSharing.defaultSearchView;
      }


      const forceUpdate = RequestSession.getContext(req).user.role >= UserRoles.Admin;
      req.resultPipe =
        await ObjectManagers.getInstance().SharingManager.updateSharing(
          sharing,
          forceUpdate
        );
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error during updating sharing link',
          err
        )
      );
    }
  }

  public static async deleteSharing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (Config.Sharing.enabled === false) {
        return next();
      }
      const sharingKey = typeof req.params === 'undefined' ? undefined : RequestParams.get(req, 'sharingKey');
      if (typeof sharingKey === 'undefined') {
        return next(
          new ErrorDTO(ErrorCodes.INPUT_ERROR, 'sharingKey is missing')
        );
      }

      // Check if user has the right to delete sharing.
      if (RequestSession.getContext(req).user.role < UserRoles.Admin) {
        const s = await ObjectManagers.getInstance().SharingManager.findOne(sharingKey);
        if (!s || s.creator.id !== RequestSession.getContext(req).user.id) {
          res.status(401);
          return next(new ErrorDTO(ErrorCodes.NOT_AUTHORISED, 'Can\'t delete sharing.'));
        }
      }
      req.resultPipe =
        await ObjectManagers.getInstance().SharingManager.deleteSharing(
          sharingKey
        );
      req.resultPipe = 'ok';
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error during deleting sharing',
          err
        )
      );
    }
  }

  public static async listSharing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (Config.Sharing.enabled === false) {
        return next();
      }
      req.resultPipe =
        await ObjectManagers.getInstance().SharingManager.listAll();
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error during listing shares',
          err
        )
      );
    }
  }

  public static async listSharingForQuery(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (Config.Sharing.enabled === false) {
        return next();
      }
      if (!req.resultPipe) {
        return next();
      }
      const query = req.resultPipe as SearchQueryDTO;
      if (RequestSession.getContext(req).user.role >= UserRoles.Admin) {
        req.resultPipe =
          await ObjectManagers.getInstance().SharingManager.listAllForQuery(query);
      } else {
        req.resultPipe =
          await ObjectManagers.getInstance().SharingManager.listAllForQuery(query, req.session.context?.user);
      }
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error during listing shares',
          err
        )
      );
    }
  }

  private static generateKey(length: number): string {
    return crypto.randomBytes(Math.ceil(length * 3 / 4))
      .toString('base64url')
      .slice(0, length);
  }
}
