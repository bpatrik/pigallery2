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
import {NgClass, NgFor, NgIf} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {NgIconComponent} from '@ng-icons/core';
import {StringifyRole} from '../../../pipes/StringifyRolePipe';
import {UserSettingsDTO} from '../../../../../common/entities/UserSettingsDTO';
import {SearchQueryDTO, SearchQueryTypes, TextSearch} from '../../../../../common/entities/SearchQueryDTO';
import {GallerySearchFieldComponent} from '../../gallery/search/search-field/search-field.gallery.component';

@Component({
  selector: 'app-settings-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
  imports: [NgIf, NgFor, FormsModule, NgClass, NgIconComponent, ModalDirective, StringifyRole, GallerySearchFieldComponent]
})
export class UsersComponent implements OnInit {

  @ViewChild('userModal', {static: false}) public childModal: ModalDirective;
  @ViewChild('editUserModal', {static: false}) public editModal: ModalDirective;
  public newUser = {} as UserDTO;
  public userRoles: { key: number; value: string }[] = [];
  public users: UserDTO[] = [];
  public error: string = null;
  public inProgress = false;

  public editUser: UserDTO = null;
  public editSettings: UserSettingsDTO = {};
  public newPassword = '';
  public editOriginalUser: UserDTO = null;

  // Confirm password fields for validation
  public newUserPasswordConfirm: string = '';
  public confirmNewPassword: string = '';

  get newUserPasswordsMismatch(): boolean {
    return !!this.newUser?.password && this.newUserPasswordConfirm !== this.newUser.password;
  }

  get editPasswordsMismatch(): boolean {
    // Only consider mismatch if at least one of them is non-empty
    if (!this.newPassword && !this.confirmNewPassword) {
      return false;
    }
    return this.newPassword !== this.confirmNewPassword;
  }

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
      this.authService.user.value?.user?.role < UserRoles.Admin
    ) {
      this.navigation.toLogin();
      return;
    }
    this.userRoles = Utils.enumToArray(UserRoles)
      .filter((r) => r.key !== UserRoles.LimitedGuest)
      .filter((r) => r.key <= this.authService.user.value?.user?.role)
      .sort((a, b) => a.key - b.key);

    this.getUsersList();
  }

  canModifyUser(user: UserDTO): boolean {
    const currentUser = this.authService.user.value?.user;
    if (!currentUser) {
      return false;
    }

    return currentUser.role >= user.role;
  }

  canDeleteUser(user: UserDTO): boolean {
    const currentUser = this.authService.user.value?.user;
    if (!currentUser) {
      return false;
    }

    return currentUser.name !== user.name && currentUser.role >= user.role;
  }

  canModifyRole(user: UserDTO): boolean {
    const currentUser = this.authService.user.value?.user;
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
    this.newUserPasswordConfirm = '';
    this.childModal.show();
  }

  async addNewUser(): Promise<void> {
    try {
      // prevent if passwords mismatch
      if (this.newUserPasswordsMismatch) {
        this.notification.error($localize`Passwords do not match`, $localize`User creation error!`);
        return;
      }
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

  async openEditUser(user: UserDTO): Promise<void> {
    await this.getUsersList();
    const fresh = this.users.find(u => u.id === user.id) || user;
    this.editUser = { ...fresh };
    this.editOriginalUser = Utils.clone(this.editUser);
    const defaultQuery: SearchQueryDTO = { type: SearchQueryTypes.any_text, value: '' } as TextSearch;
    this.editSettings = {
      overrideAllowBlockList: fresh.overrideAllowBlockList ?? false,
      allowQuery: fresh.allowQuery ?? defaultQuery,
      blockQuery: fresh.blockQuery ?? defaultQuery
    } as UserSettingsDTO;
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.editModal.show();
  }


  async saveEditUser(): Promise<void> {
    try {

      // Save role if changed
      if (this.editUser.role !== this.editOriginalUser?.role) {
        if (!this.canModifyRole(this.editOriginalUser)) {
          this.notification.error($localize`Can't modify user role`);
          return;
        }
        await this.userSettings.updateRole(this.editUser);
      }

      // Check password confirmation for edit
      if (this.editPasswordsMismatch) {
        this.notification.error($localize`Passwords do not match`, $localize`Could not save user settings`);
        return;
      }

      const settings: UserSettingsDTO = {
        overrideAllowBlockList: this.editSettings.overrideAllowBlockList,
        allowQuery: this.editSettings.overrideAllowBlockList ? this.editSettings.allowQuery : null,
        blockQuery: this.editSettings.overrideAllowBlockList ? this.editSettings.blockQuery : null,
      } as UserSettingsDTO;
      if (this.newPassword && this.newPassword.length > 0) {
        settings.newPassword = this.newPassword;
      }
      await this.userSettings.updateSettings(this.editUser.id, settings);
      this.notification.success($localize`User settings saved successfully`);
      await this.getUsersList();
      this.editModal.hide();
    } catch (e) {
      const err: ErrorDTO = e;
      this.notification.error(
        (err?.message || '') + (err?.details ? ', ' + err.details : ''),
        $localize`Could not save user settings`
      );
    }
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
