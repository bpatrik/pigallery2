import '../../../../common/config/public/Config';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA, signal} from '@angular/core';
import {ShareLoginComponent} from './share-login.component';
import {AuthenticationService} from '../../model/network/authentication.service';
import {NavigationService} from '../../model/navigation.service';
import {ShareService} from '../gallery/share.service';
import {LanguageComponent} from '../language/language.component';
import {IconComponent} from '../../icon.component';
import {ErrorCodes, ErrorDTO} from '../../../../common/entities/Error';

describe('ShareLoginComponent', () => {

  const render = async (shareLogin: (password: string) => Promise<unknown>): Promise<ComponentFixture<ShareLoginComponent>> => {
    TestBed.configureTestingModule({
      providers: [
        {provide: AuthenticationService, useValue: {isAuthenticated: signal(false), shareLogin}},
        {provide: NavigationService, useValue: null},
        {provide: ShareService, useValue: {sharingIsValid: signal(true)}},
      ]
    });
    TestBed.overrideComponent(ShareLoginComponent, {
      remove: {imports: [LanguageComponent, IconComponent]},
      add: {schemas: [NO_ERRORS_SCHEMA]}
    });
    const fixture = TestBed.createComponent(ShareLoginComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return fixture;
  };

  // #1306: the next try starts with an empty, focused password field
  it('should clear the password after a wrong one', async () => {
    const shareLogin = vi.fn((): Promise<unknown> => Promise.reject(new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND)));
    const fixture = await render(shareLogin);
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('#password')!;
    input.value = 'wrong pässword';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('#button-share-login')!.click();
    await vi.waitFor(() => expect(el.querySelector('.error-message')!.hasAttribute('hidden')).toBe(false));
    await fixture.whenStable();

    expect(shareLogin).toHaveBeenCalledWith('wrong pässword');
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });
});
