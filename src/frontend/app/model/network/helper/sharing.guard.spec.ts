import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, provideRouter, RedirectCommand, RouterStateSnapshot} from '@angular/router';
import {sharingGuard} from './sharing.guard';
import {ShareService} from '../../../ui/gallery/share.service';
import {AuthenticationService} from '../authentication.service';
import {NavigationService} from '../../navigation.service';
import {PublicSharingDTO} from '../../../../../common/entities/SharingDTO';

describe('sharingGuard', () => {
  let share: { wait: ReturnType<typeof vi.fn>, isSharing: ReturnType<typeof vi.fn>, getPublicSharing: ReturnType<typeof vi.fn> };
  let auth: { isAuthenticated: ReturnType<typeof vi.fn> };
  let navigation: { toLogin: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    share = {
      wait: vi.fn().mockResolvedValue(undefined),
      isSharing: vi.fn().mockReturnValue(true),
      getPublicSharing: vi.fn(),
    };
    auth = {isAuthenticated: vi.fn().mockReturnValue(true)};
    navigation = {toLogin: vi.fn().mockResolvedValue(true)};
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: ShareService, useValue: share},
        {provide: AuthenticationService, useValue: auth},
        {provide: NavigationService, useValue: navigation},
      ]
    });
  });

  const run = (): Promise<unknown> => TestBed.runInInjectionContext(() =>
    sharingGuard({} as ActivatedRouteSnapshot, {url: '/share/key'} as RouterStateSnapshot) as Promise<unknown>);

  it('should open the gallery without a sharing', async () => {
    share.isSharing.mockReturnValue(false);
    expect(await run()).toBe(true);
    expect(share.getPublicSharing).not.toHaveBeenCalled();
  });

  it('should open the gallery of a valid sharing', async () => {
    share.getPublicSharing.mockResolvedValue({sharingKey: 'key'} as PublicSharingDTO);
    expect(await run()).toBe(true);
  });

  it('should leave the login to the auth guard for a valid sharing', async () => {
    share.getPublicSharing.mockResolvedValue({sharingKey: 'key', passwordProtected: true} as PublicSharingDTO);
    auth.isAuthenticated.mockReturnValue(false);

    expect(await run()).toBe(false);
    expect(navigation.toLogin).toHaveBeenCalledWith('/share/key');
  });

  // #1307: a missing, expired or deleted sharing, also for a guest; the address bar keeps the link
  it('should show the invalid link page for an invalid sharing, keeping the url', async () => {
    share.getPublicSharing.mockResolvedValue(null);
    auth.isAuthenticated.mockReturnValue(false);

    const result = await run();

    expect(result).toBeInstanceOf(RedirectCommand);
    const command = result as RedirectCommand;
    expect(command.redirectTo.toString()).toBe('/invalidSharing');
    expect(command.navigationBehaviorOptions?.skipLocationChange).toBe(true);
    // no login for an invalid sharing
    expect(navigation.toLogin).not.toHaveBeenCalled();
  });
});
