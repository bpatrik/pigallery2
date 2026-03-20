import {ExtensionObject} from './ExtensionObject';
import {IClientMediaButtonConfig} from '../../../common/entities/extension/IClientUIConfig';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';
import {ParamsDictionary} from 'express-serve-static-core';
import {MediaEntity} from '../database/enitites/MediaEntity';
import {IMediaRequestBody, IUIExtension} from './IExtension';
import {Repository} from 'typeorm';
import {Logger} from '../../Logger';

export class UIExtension<C> implements IUIExtension<C> {
  public buttonConfigs: IClientMediaButtonConfig[] = [];

  constructor(private extensionObject: ExtensionObject<C>) {
  }

  public addMediaButton(buttonConfig: IClientMediaButtonConfig, serverSB: (params: ParamsDictionary, body: IMediaRequestBody, user: UserDTO, media: MediaEntity, repository: Repository<MediaEntity>) => Promise<void>): void {
    this.buttonConfigs.push(buttonConfig);
    // api path isn't set
    if (!buttonConfig.apiPath && serverSB) {
      Logger.warn('[UIExtension]', `Button config ${buttonConfig.name} has no apiPath, but has callback function. This is not supported.`);
      return;
    }
    this.extensionObject.RESTApi.post.mediaJsonResponse([buttonConfig.apiPath], buttonConfig.minUserRole || UserRoles.LimitedGuest, !buttonConfig.skipDirectoryInvalidation, serverSB);
  }
}
