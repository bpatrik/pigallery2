import {Component, OnInit, ViewChild} from '@angular/core';
import {ModalDirective} from 'ngx-bootstrap/modal';
import {UserDTO, UserRoles} from '../../../../../common/entities/UserDTO';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {NavigationService} from '../../../model/navigation.service';
import {NotificationService} from '../../../model/notification.service';
import {Utils} from '../../../../../common/Utils';
import {ErrorCodes, ErrorDTO} from '../../../../../common/entities/Error';
import {UsersSettingsService} from './users.service';
import {SettingsService} from '../settings.service';

@Component({
  selector: 'app-settings-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {

  @ViewChild('userModal', {static: false}) public childModal: ModalDirective;
  public newUser = {} as UserDTO;
  public userRoles: { key: number; value: string }[] = [];
  public users: UserDTO[] = [];
  public error: string = null;
  public inProgress = false;
  Changed = false;


  constructor(
      private authService: AuthenticationService,
      private navigation: NavigationService,
      private userSettings: UsersSettingsService,
      private settingsService: SettingsService,
      private notification: NotificationService
  ) {
  }

  ngOnInit(): void {
    if (
        !this.authService.isAuthenticated() ||
        this.authService.user.value.role < UserRoles.Admin
    ) {
      this.navigation.toLogin();
      return;
    }
    this.userRoles = Utils.enumToArray(UserRoles)
        .filter((r) => r.key !== UserRoles.LimitedGuest)
        .filter((r) => r.key <= this.authService.user.value.role)
        .sort((a, b) => a.key - b.key);

    this.getUsersList();
  }

  canModifyUser(user: UserDTO): boolean {
    const currentUser = this.authService.user.value;
    if (!currentUser) {
      return false;
    }

    return currentUser.name !== user.name && currentUser.role >= user.role;
  }

  get Enabled(): boolean {
    return this.settingsService.settings.value.Users.authenticationRequired;
  }


  initNewUser(): void {
    this.newUser = {role: UserRoles.User} as UserDTO;
    this.childModal.show();
  }

  async addNewUser(): Promise<void> {
    try {
      await this.userSettings.createUser(this.newUser);
      await this.getUsersList();
      this.childModal.hide();
    } catch (e) {
      const err: ErrorDTO = e;
      this.notification.error(
          err.message + ', ' + err.details,
          $localize`User creation error!`
      );
    }
  }

  async updateRole(user: UserDTO): Promise<void> {
    await this.userSettings.updateRole(user);
    await this.getUsersList();
    this.childModal.hide();
  }

  async deleteUser(user: UserDTO): Promise<void> {
    await this.userSettings.deleteUser(user);
    await this.getUsersList();
    this.childModal.hide();
  }

  private async getUsersList(): Promise<void> {
    try {
      this.users = await this.userSettings.getUsers();
    } catch (err) {
      this.users = [];
      if ((err as ErrorDTO).code !== ErrorCodes.USER_MANAGEMENT_DISABLED) {
        throw err;
      }
    }
  }

}
