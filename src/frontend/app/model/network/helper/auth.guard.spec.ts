import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, RouterStateSnapshot} from '@angular/router';
import {adminGuard} from './auth.guard';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {ToastService} from '../../../ui/toast/toast.service';
import {UserRoles} from '../../../../../common/entities/UserDTO';

describe('adminGuard', () => {
  let role: UserRoles | null;
  let navigation: { toLogin: ReturnType<typeof vi.fn>, toGallery: ReturnType<typeof vi.fn> };
  let toast: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    role = UserRoles.Admin;
    navigation = {toLogin: vi.fn().mockResolvedValue(true), toGallery: vi.fn().mockResolvedValue(true)};
    toast = {open: vi.fn()};
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthenticationService, useValue: {
            isAuthenticated: (): boolean => role !== null,
            isAuthorized: (r: UserRoles): boolean => role !== null && role >= r
          }
        },
        {provide: NavigationService, useValue: navigation},
        {provide: ToastService, useValue: toast},
      ]
    });
  });

  const run = (): unknown => TestBed.runInInjectionContext(() =>
    adminGuard({} as ActivatedRouteSnapshot, {url: '/admin'} as RouterStateSnapshot));

  it('should open the admin page for an admin', () => {
    expect(run()).toBe(true);
    expect(toast.open).not.toHaveBeenCalled();
  });

  it('should send a guest to the login, back to the admin page after it', () => {
    role = null;
    expect(run()).toBe(false);
    expect(navigation.toLogin).toHaveBeenCalledWith('/admin');
  });

  // #1315: a logged-in user is not sent to the login, but to the gallery with a warning
  it('should send a normal user to the gallery with a warning toast', () => {
    role = UserRoles.User;
    expect(run()).toBe(false);
    expect(navigation.toLogin).not.toHaveBeenCalled();
    expect(navigation.toGallery).toHaveBeenCalled();
    expect(toast.open).toHaveBeenCalledWith(expect.objectContaining({type: 'warning'}));
  });
});
