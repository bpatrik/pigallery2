import '../../../../common/config/public/Config';
import {TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA, computed, signal} from '@angular/core';
import {provideIcons} from '@ng-icons/core';
import {AboutComponent} from './about.component';
import {FrameComponent} from '../frame/frame.component';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ReleaseNotesService} from '../../model/release-notes.service';
import {PiTitleService} from '../../model/pi-title.service';
import {NotificationService} from '../../model/notification.service';
import {QueryService} from '../../model/query.service';
import {provideRouter} from '@angular/router';
import {ReleaseNotesDTO} from '../../../../common/entities/ReleaseNotesDTO';
import {appIcons} from '../../icons';

describe('AboutComponent', () => {
  const releaseNotes: ReleaseNotesDTO = {
    build: {appVersion: '3.8.0', buildTime: '2026-11-16T10:00:00.000Z', buildCommitHash: 'abc1234def5678',
      upTime: '2026-11-16T12:00:00.000Z', isDocker: true, nodeVersion: 'v22.11.0', platform: 'linux/arm64'},
    notes: '## Main new features',
    seenVersion: '3.8.0'
  };

  const render = async (admin: boolean): Promise<{ el: HTMLElement, open: ReturnType<typeof vi.fn> }> => {
    const open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideIcons(appIcons),
        {provide: AuthenticationService, useValue: {isAdmin: signal(admin)}},
        // the service loads the notes only for admins
        {provide: ReleaseNotesService, useValue: {notes: computed(() => admin ? releaseNotes : null), open}},
        {provide: PiTitleService, useValue: {setTitle: (): void => undefined}},
        {provide: NotificationService, useValue: {success: vi.fn()}},
        {provide: QueryService, useValue: {params: signal({})}},
        provideRouter([]),
      ]
    });
    // the navbar (app-frame) is not needed: only the page itself is rendered
    TestBed.overrideComponent(AboutComponent, {
      remove: {imports: [FrameComponent]},
      add: {schemas: [NO_ERRORS_SCHEMA]}
    });
    const fixture = TestBed.createComponent(AboutComponent);
    await fixture.whenStable();
    return {el: fixture.nativeElement as HTMLElement, open};
  };

  it('should show the sponsor links to everyone', async () => {
    const {el} = await render(false);
    expect(el.querySelector('#about-support a[href="https://github.com/sponsors/bpatrik"]')).not.toBeNull();
    expect(el.querySelector('#about-support a[href="https://ko-fi.com/pigallery2"]')).not.toBeNull();
  });

  it('should show the icon of PiGallery2', async () => {
    const {el} = await render(false);
    expect(el.querySelector('header app-icon')).not.toBeNull();
  });

  it('should not show the version to a non-admin', async () => {
    const {el} = await render(false);
    expect(el.querySelector('#about-version')).toBeNull();
    expect(el.textContent).not.toContain('3.8.0');
  });

  it('should show the version and the release notes to an admin', async () => {
    const {el, open} = await render(true);
    expect(el.querySelector('#about-app-version')?.textContent).toBe('v3.8.0');
    // the commit is shortened like GitHub does
    const commit = el.querySelector<HTMLAnchorElement>('#about-commit')!;
    expect(commit.textContent).toBe('abc1234');
    expect(commit.href).toBe('https://github.com/bpatrik/pigallery2/commit/abc1234def5678');
    expect(el.querySelector('#about-build-version')?.textContent).toBe('v3.8.0');
    expect(el.querySelector('#about-up-time')?.textContent).toContain('2026');
    expect(el.querySelector('#about-runtime')?.textContent).toBe('Node.js v22.11.0 · linux/arm64 · Docker');
    el.querySelector<HTMLButtonElement>('#about-whats-new')!.click();
    expect(open).toHaveBeenCalledOnce();
  });
});
