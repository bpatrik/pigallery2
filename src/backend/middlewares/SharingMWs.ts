import {NextFunction, Request, Response} from 'express';
import {CreateSharingDTO, SharingDTO, SharingDTOKey} from '../../common/entities/SharingDTO';
import {ObjectManagers} from '../model/ObjectManagers';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {Config} from '../../common/config/private/Config';
import {QueryParams} from '../../common/QueryParams';
import * as path from 'path';
import {UserRoles} from '../../common/entities/UserDTO';

export class SharingMWs {
  public static async getSharing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Sharing.enabled === false) {
      return next();
    }
    const sharingKey = req.params[QueryParams.gallery.sharingKey_params];

    try {
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

  public static async getSharingKey(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Sharing.enabled === false) {
      return next();
    }
    const sharingKey = req.params[QueryParams.gallery.sharingKey_params];

    try {
      req.resultPipe =
        {sharingKey: (await ObjectManagers.getInstance().SharingManager.findOne(sharingKey)).sharingKey} as SharingDTOKey;
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

    let sharingKey = SharingMWs.generateKey();

    // create one not yet used
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await ObjectManagers.getInstance().SharingManager.findOne(sharingKey);
        sharingKey = this.generateKey();
      } catch (err) {
        break;
      }
    }

    const directoryName = path.normalize(req.params['directory'] || '/');
    const sharing: SharingDTO = {
      id: null,
      sharingKey,
      path: directoryName,
      password: createSharing.password,
      creator: req.session['user'],
      expires:
        createSharing.valid >= 0 // if === -1 its forever
          ? Date.now() + createSharing.valid
          : new Date(9999, 0, 1).getTime(), // never expire
      includeSubfolders: createSharing.includeSubfolders,
      timeStamp: Date.now(),
    };

    try {
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
    const directoryName = path.normalize(req.params['directory'] || '/');
    const sharing: SharingDTO = {
      id: updateSharing.id,
      path: directoryName,
      sharingKey: '',
      password:
        updateSharing.password && updateSharing.password !== ''
          ? updateSharing.password
          : null,
      creator: req.session['user'],
      expires:
        updateSharing.valid >= 0 // if === -1 its forever
          ? Date.now() + updateSharing.valid
          : new Date(9999, 0, 1).getTime(), // never expire
      includeSubfolders: updateSharing.includeSubfolders,
      timeStamp: Date.now(),
    };

    try {
      const forceUpdate = req.session['user'].role >= UserRoles.Admin;
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
    if (Config.Sharing.enabled === false) {
      return next();
    }
    if (
      typeof req.params === 'undefined' ||
      typeof req.params['sharingKey'] === 'undefined'
    ) {
      return next(
        new ErrorDTO(ErrorCodes.INPUT_ERROR, 'sharingKey is missing')
      );
    }
    const sharingKey: string = req.params['sharingKey'];

    try {
      // Check if user has the right to delete sharing.
      if (req.session['user'].role < UserRoles.Admin) {
        const s = await ObjectManagers.getInstance().SharingManager.findOne(sharingKey);
        if (s.creator.id !== req.session['user'].id) {
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
    if (Config.Sharing.enabled === false) {
      return next();
    }
    try {
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

  public static async listSharingForDir(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Sharing.enabled === false) {
      return next();
    }

    const dir = path.normalize(req.params['directory'] || '/');
    try {
      if (req.session['user'].role >= UserRoles.Admin) {
        req.resultPipe =
          await ObjectManagers.getInstance().SharingManager.listAllForDir(dir);
      } else {
        req.resultPipe =
          await ObjectManagers.getInstance().SharingManager.listAllForDir(dir, req.session['user']);
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

  private static generateKey(): string {
    function s4(): string {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }

    return s4() + s4();
  }
}
