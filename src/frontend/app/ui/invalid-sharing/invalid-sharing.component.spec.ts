import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {provideIcons} from '@ng-icons/core';
import {InvalidSharingComponent} from './invalid-sharing.component';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ShareService} from '../gallery/share.service';
import {NavigationService} from '../../model/navigation.service';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {appIcons} from '../../icons';

describe('InvalidSharingComponent', () => {
  const user = signal<UserDTO | null>(null);
  let share: { dropSharing: ReturnType<typeof vi.fn> };
  let navigation: { toDefault: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    user.set(null);
    share = {dropSharing: vi.fn()};
    navigation = {toDefault: vi.fn().mockResolvedValue(true)};
    TestBed.configureTestingModule({
      imports: [InvalidSharingComponent],
      providers: [
        provideIcons(appIcons),
        {provide: AuthenticationService, useValue: {user}},
        {provide: ShareService, useValue: share},
        {provide: NavigationService, useValue: navigation},
      ]
    });
  });

  const render = (): HTMLElement => {
    const fixture = TestBed.createComponent(InvalidSharingComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('should tell a guest that the link is invalid, without a way into the gallery', () => {
    const el = render();
    expect(el.textContent).toContain('This link is invalid or has expired.');
    expect(el.querySelector('button')).toBeNull();
  });

  it('should not offer the gallery to the guest of a sharing', () => {
    user.set({name: 'guest', role: UserRoles.LimitedGuest, usedSharingKey: 'key'} as UserDTO);
    expect(render().querySelector('button')).toBeNull();
  });

  it('should take a logged in user to the own gallery, leaving the sharing', () => {
    user.set({name: 'user', role: UserRoles.User} as UserDTO);
    const button = render().querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Go to your gallery');

    button.click();

    expect(share.dropSharing).toHaveBeenCalled();
    expect(navigation.toDefault).toHaveBeenCalled();
  });
});
