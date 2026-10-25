import {Injectable} from '@angular/core';
import {UserDTO} from '../../../../../common/entities/UserDTO';
import {NetworkService} from '../../../model/network/network.service';
import {UserSettingsDTO} from '../../../../../common/entities/UserSettingsDTO';

@Injectable({
  providedIn: 'root'
})
export class UsersSettingsService {

  constructor(private networkService: NetworkService) {
  }

  public createUser(user: UserDTO): Promise<string> {
    return this.networkService.putJson('/user', {newUser: user});
  }


  public getUsers(): Promise<Array<UserDTO>> {
    return this.networkService.getJson('/user/list');
  }

  public deleteUser(user: UserDTO): Promise<void> {
    return this.networkService.deleteJson('/user/' + user.id);
  }

  public unlinkOidc(user: UserDTO): Promise<void> {
    return this.networkService.deleteJson('/user/' + user.id + '/oidc');
  }

  public updateRole(user: UserDTO): Promise<void> {
    return this.networkService.postJson('/user/' + user.id + '/role', {
      newRole: user.role,
    });
  }

  public updateSettings(userId: number, settings: UserSettingsDTO): Promise<void> {
    return this.networkService.postJson('/user/' + userId + '/settings', {
      settings
    });
  }
}
