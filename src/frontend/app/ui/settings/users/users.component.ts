import { Component, OnInit, inject, viewChild, computed, signal } from '@angular/core';
import {ModalDirective} from 'ngx-bootstrap/modal';
import {UserDTO, UserRoles} from '../../../../../common/entities/UserDTO';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {NavigationService} from '../../../model/navigation.service';
import {NotificationService} from '../../../model/notification.service';
import {Utils} from '../../../../../common/Utils';
import {ErrorCodes, ErrorDTO} from '../../../../../common/entities/Error';
import {UsersSettingsService} from './users.service';
import {SettingsService} from '../settings.service';

import {FormsModule} from '@angular/forms';
import {NgIconComponent} from '@ng-icons/core';
import {UserSettingsDTO} from '../../../../../common/entities/UserSettingsDTO';
import {DirectorySearchListSettingsComponent} from '../directory-search-list/directory-search-list.settings.component';
import {
  DirectorySearch,
  SearchQueryDTO,
  SearchQueryTypes,
  TextSearch
} from '../../../../../common/entities/SearchQueryDTO';
import {GallerySearchFieldComponent} from '../../gallery/search/search-field/search-field.gallery.component';

@Component({
  selector: 'app-settings-users',
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
  imports: [FormsModule, NgIconComponent, ModalDirective, GallerySearchFieldComponent, DirectorySearchListSettingsComponent]
})
export class UsersComponent implements OnInit {
  private authService = inject(AuthenticationService);
  private navigation = inject(NavigationService);
  private userSettings = inject(UsersSettingsService);
  private settingsService = inject(SettingsService);
  private notification = inject(NotificationService);


  public readonly childModal = viewChild<ModalDirective>('userModal');
  public readonly editModal = viewChild<ModalDirective>('editUserModal');
  public newUser = {} as UserDTO;
  public userRoles: { key: number; value: string }[] = [];
  public readonly users = signal<UserDTO[]>([]);
  // the users with what the current user may do with them
  readonly userRows = computed((): { user: UserDTO; roleName: string; canDelete: boolean; canModify: boolean }[] => {
    const currentUser = this.authService.user();
    return this.users().map(user => ({
      user,
      roleName: UserRoles[user.role],
      canDelete: this.canDeleteUser(currentUser, user),
      canModify: this.canModifyUser(currentUser, user)
    }));
  });
  public error: string | null = null;
  public inProgress = false;

  public editUser: UserDTO | null = null;
  public editSettings: UserSettingsDTO = {};
  public newPassword = '';
  public readonly editOriginalUser = signal<UserDTO | null>(null);
  readonly canModifyRole = computed<boolean>(() => this.canModifyUserRole(this.authService.user(), this.editOriginalUser()));

  // Confirm password fields for validation
  public newUserPasswordConfirm = '';
  public confirmNewPassword = '';

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

  ngOnInit(): void {
    if (
      !this.authService.isAuthenticated() ||
      !this.authService.isAuthorized(UserRoles.Admin)
    ) {
      this.navigation.toLogin();
      return;
    }
    this.userRoles = Utils.enumToArray(UserRoles)
      .filter((r) => r.key !== UserRoles.LimitedGuest)
      .filter((r) => this.authService.isAuthorized(r.key))
      .sort((a, b) => a.key - b.key);

    this.getUsersList();
  }

  private canModifyUser(currentUser: UserDTO | null, user: UserDTO): boolean {
    if (!currentUser) {
      return false;
    }

    return currentUser.role >= user.role;
  }

  private canDeleteUser(currentUser: UserDTO | null, user: UserDTO): boolean {
    if (!currentUser) {
      return false;
    }

    return currentUser.name !== user.name && currentUser.role >= user.role;
  }

  private canModifyUserRole(currentUser: UserDTO | null, user: UserDTO | null): boolean {
    if (!currentUser || !user) {
      return false;
    }

    return currentUser.name !== user.name && currentUser.role >= user.role;
  }

  readonly Enabled = computed<boolean>(() => this.settingsService.settings().Users.authenticationRequired);


  initNewUser(): void {
    this.newUser = {role: UserRoles.User} as UserDTO;
    this.newUserPasswordConfirm = '';
    this.childModal()?.show();
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
      this.childModal()?.hide();
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
    this.childModal()?.hide();
  }

  async deleteUser(user: UserDTO): Promise<void> {
    await this.userSettings.deleteUser(user);
    await this.getUsersList();
    this.childModal()?.hide();
  }

  async unlinkOidc(user: UserDTO): Promise<void> {
    await this.userSettings.unlinkOidc(user);
    await this.getUsersList();
  }

  async openEditUser(user: UserDTO): Promise<void> {
    await this.getUsersList();
    const fresh = this.users().find(u => u.id === user.id) || user;
    this.editUser = { ...fresh };
    this.editOriginalUser.set(Utils.clone(this.editUser));
    const defaultQuery: SearchQueryDTO = { type: SearchQueryTypes.any_text, value: '' } as TextSearch;
    this.editSettings = {
      overrideAllowBlockList: fresh.overrideAllowBlockList ?? false,
      allowQuery: fresh.allowQuery ?? defaultQuery,
      blockQuery: fresh.blockQuery ?? defaultQuery,
      allowDirectoryList: Utils.clone(fresh.allowDirectoryList ?? []),
      blockDirectoryList: Utils.clone(fresh.blockDirectoryList ?? [])
    } as UserSettingsDTO;
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.editModal()?.show();
  }



  private cleanDirectoryList(list: DirectorySearch[] | null | undefined): DirectorySearch[] {
    return (list || []).filter(d => d.value && d.value.trim() !== '');
  }

  async saveEditUser(): Promise<void> {
    const editUser = this.editUser;
    if (!editUser) {
      return;
    }
    try {

      // Save role if changed
      if (editUser.role !== this.editOriginalUser()?.role) {
        if (!this.canModifyRole()) {
          this.notification.error($localize`Can't modify user role`);
          return;
        }
        await this.userSettings.updateRole(editUser);
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
        // empty rows are ignored
        allowDirectoryList: this.editSettings.overrideAllowBlockList ? this.cleanDirectoryList(this.editSettings.allowDirectoryList) : null,
        blockDirectoryList: this.editSettings.overrideAllowBlockList ? this.cleanDirectoryList(this.editSettings.blockDirectoryList) : null,
      } as UserSettingsDTO;
      if (this.newPassword && this.newPassword.length > 0) {
        settings.newPassword = this.newPassword;
      }
      await this.userSettings.updateSettings(editUser.id, settings);
      this.notification.success($localize`User settings saved successfully`);
      await this.getUsersList();
      this.editModal()?.hide();
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
      this.users.set(await this.userSettings.getUsers());
    } catch (err) {
      this.users.set([]);
      if ((err as ErrorDTO).code !== ErrorCodes.USER_MANAGEMENT_DISABLED) {
        throw err;
      }
    }
  }

}
