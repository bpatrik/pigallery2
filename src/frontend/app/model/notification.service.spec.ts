import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {NotificationService} from './notification.service';
import {ToastService} from '../ui/toast/toast.service';
import {NetworkService} from './network/network.service';
import {AuthenticationService} from './network/authentication.service';
import {NotificationDTO, NotificationType} from '../../../common/entities/NotificationDTO';
import {UserDTO, UserRoles} from '../../../common/entities/UserDTO';

// the server notifications (#1315), e.g. the warning that the default admin password is still in use
describe('NotificationService', () => {
  const defaultAdminWarning: NotificationDTO = {
    type: NotificationType.error,
    message: 'Using default admin user!',
    details: 'You are using the default user: "admin", password: "admin". The is a security issue. Please change the password or remove the user.'
  };

  const setUp = (user: UserDTO | null, notifications: NotificationDTO[]) => {
    const getJson = vi.fn().mockResolvedValue(notifications);
    const open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {provide: ToastService, useValue: {registerGroup: vi.fn(), open}},
        {provide: NetworkService, useValue: {getJson}},
        {provide: AuthenticationService, useValue: {user: signal(user), isAuthenticated: () => user !== null}},
      ]
    });
    const service = TestBed.inject(NotificationService);
    return {service, getJson, open};
  };

  it('should load the server notifications for the logged in admin and show them as toasts', async () => {
    const {service, getJson, open} = setUp({id: 1, name: 'admin', role: UserRoles.Admin} as UserDTO,
      [defaultAdminWarning, defaultAdminWarning]);
    TestBed.tick(); // runs the effect that reacts to the user
    await vi.waitFor(() => expect(open).toHaveBeenCalled());

    expect(getJson).toHaveBeenCalledWith('/notifications');
    expect(service.numberOfNotifications()).toBe(2);
    // the same notification twice is shown once, with its count
    expect(service.countedNotifications().map(n => [n.message, n.count])).toEqual([['Using default admin user!', 2]]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatchObject({type: 'error', title: '(2) Using default admin user!'});
    expect(open.mock.calls[0][0].text).toContain('Please change the password');
  });

  it('should not ask for the notifications without a logged in user or for a guest', async () => {
    const {getJson} = setUp(null, [defaultAdminWarning]);
    TestBed.tick();
    TestBed.resetTestingModule();
    const guest = setUp({id: 2, name: 'visitor', role: UserRoles.Guest} as UserDTO, [defaultAdminWarning]);
    TestBed.tick();
    await Promise.resolve();
    expect(getJson).not.toHaveBeenCalled();
    expect(guest.getJson).not.toHaveBeenCalled();
  });
});
