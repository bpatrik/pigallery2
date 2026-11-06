import '../../../../../common/config/public/Config';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {UsersComponent} from './users.component';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {NavigationService} from '../../../model/navigation.service';
import {NotificationService} from '../../../model/notification.service';
import {UsersSettingsService} from './users.service';
import {SettingsService} from '../settings.service';
import {UserDTO, UserRoles} from '../../../../../common/entities/UserDTO';

describe('UsersComponent', () => {
  const admin = {id: 1, name: 'Ádám', role: UserRoles.Admin} as UserDTO;
  const developer = {id: 2, name: 'Őrs', role: UserRoles.Developer} as UserDTO;
  const guest = {id: 3, name: 'Éva', role: UserRoles.Guest} as UserDTO;

  const setUp = () => {
    const user = signal<UserDTO | null>(admin);
    TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        {provide: AuthenticationService, useValue: {user, isAuthenticated: () => true}},
        {provide: NavigationService, useValue: {toLogin: vi.fn()}},
        {provide: NotificationService, useValue: {}},
        {provide: UsersSettingsService, useValue: {getUsers: vi.fn().mockResolvedValue([admin, developer, guest])}},
        {provide: SettingsService, useValue: {settings: signal({Users: {authenticationRequired: true}})}},
      ]
    });
    // only the derived state is tested here
    TestBed.overrideComponent(UsersComponent, {set: {template: '', imports: []}});
    const fixture = TestBed.createComponent(UsersComponent);
    return {component: fixture.componentInstance, user};
  };

  it('should list the users with their role and what the current user may do', () => {
    const {component, user} = setUp();
    component.users.set([admin, developer, guest]);
    expect(component.Enabled()).toBe(true);
    expect(component.userRows().map(r => [r.user.name, r.roleName, r.canDelete, r.canModify])).toEqual([
      ['Ádám', 'Admin', false, true],
      ['Őrs', 'Developer', false, false],
      ['Éva', 'Guest', true, true],
    ]);

    user.set(null);
    expect(component.userRows().every(r => !r.canDelete && !r.canModify)).toBe(true);
  });

  it('should only allow modifying the role of others with a lower or equal role', () => {
    const {component} = setUp();
    expect(component.canModifyRole()).toBe(false);
    component.editOriginalUser.set(guest);
    expect(component.canModifyRole()).toBe(true);
    component.editOriginalUser.set(admin);
    expect(component.canModifyRole()).toBe(false);
    component.editOriginalUser.set(developer);
    expect(component.canModifyRole()).toBe(false);
  });
});
