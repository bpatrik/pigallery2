import {Injectable} from '@angular/core';
import {LoginCredential} from '../../../../common/entities/LoginCredential';
import {NetworkService} from './network.service';
import {UserDTO} from '../../../../common/entities/UserDTO';
import {Config} from '../../../../common/config/public/Config';
import {ShareService} from '../../ui/gallery/share.service';
import {QueryParams} from '../../../../common/QueryParams';

@Injectable()
export class UserService {
  constructor(
      private networkService: NetworkService,
      private shareService: ShareService
  ) {
  }

  public async logout(): Promise<string> {
    return this.networkService.postJson('/user/logout');
  }

  public async login(credential: LoginCredential): Promise<UserDTO> {
    return this.networkService.postJson<UserDTO>('/user/login', {
      loginCredential: credential,
    });
  }

  public async shareLogin(password: string): Promise<UserDTO> {
    return this.networkService.postJson<UserDTO>(
        '/share/login?' +
        QueryParams.gallery.sharingKey_query +
        '=' +
        this.shareService.getSharingKey(),
        {password}
    );
  }

  public async getSessionUser(): Promise<UserDTO> {
    await this.shareService.wait();
    if (Config.Sharing.enabled === true) {
      if (this.shareService.isSharing()) {
        const query: any = {};
        query[QueryParams.gallery.sharingKey_query] =
            this.shareService.getSharingKey();
        return this.networkService.getJson<UserDTO>('/user/me', query);
      }
    }
    return this.networkService.getJson<UserDTO>('/user/me');
  }
}
