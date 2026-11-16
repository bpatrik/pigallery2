import {Injectable, computed, effect, inject, resource, signal, untracked} from '@angular/core';
import {NetworkService} from './network/network.service';
import {AuthenticationService} from './network/authentication.service';
import {ReleaseNotesDTO} from '../../../common/entities/ReleaseNotesDTO';

/**
 * The build info and release notes of the running version, only for admins.
 * Opens the "What's new" popup once per version, until the admin confirms it.
 */
@Injectable({providedIn: 'root'})
export class ReleaseNotesService {
  public static readonly ReleasesUrl = 'https://github.com/bpatrik/pigallery2/releases';

  private networkService = inject(NetworkService);
  private authService = inject(AuthenticationService);

  // loads once an admin is logged in
  public readonly releaseNotes = resource({
    params: () => this.authService.isAdmin() ? true : undefined,
    loader: async () => {
      const dto = await this.networkService.getJson<ReleaseNotesDTO>('/admin/release-notes');
      return {...dto, notes: ReleaseNotesService.cleanNotes(dto.notes)};
    }
  });
  public readonly notes = computed((): ReleaseNotesDTO | null =>
    this.releaseNotes.hasValue() ? this.releaseNotes.value() : null);
  public readonly isOpen = signal(false);
  // the popup opens by itself only once per page load (e.g.: not again after the admin closed it)
  private autoOpened = false;

  constructor() {
    effect(() => {
      const notes = this.notes();
      if (!notes || this.autoOpened || !ReleaseNotesService.isUnseen(notes)) {
        return;
      }
      this.autoOpened = true;
      untracked(() => this.isOpen.set(true));
    });
  }

  /**
   * An -edge version keeps its version string during the whole development of the next release,
   * so its half-written notes would show once and never again: edge never opens the popup by itself.
   */
  public static isUnseen(notes: ReleaseNotesDTO): boolean {
    const version = notes.build.appVersion;
    return !!version && !!notes.notes && !version.includes('-edge') && notes.seenVersion !== version;
  }

  /**
   * RELEASE_NOTES.md starts with a comment for its writers and has the empty headings of a release in progress:
   * shows the sections from the first heading on, without the empty ones. Null if nothing is left.
   * (No HTML stripping here: the markdown component sanitizes what it renders.)
   */
  public static cleanNotes(markdown: string | null): string | null {
    const sections = (markdown ?? '')
      .split(/^(?=#{1,6}\s)/m)
      .map(s => s.trim())
      .filter(s => {
        const [first, ...rest] = s.split('\n');
        return /^#{1,6}\s/.test(first) && rest.join('').trim() !== '';
      });
    return sections.length > 0 ? sections.join('\n\n') : null;
  }

  public open(): void {
    this.isOpen.set(true);
  }

  public async close(): Promise<void> {
    this.isOpen.set(false);
    const notes = this.notes();
    if (!notes || notes.seenVersion === notes.build.appVersion) {
      return;
    }
    await this.networkService.postJson('/admin/release-notes/seen');
    this.releaseNotes.set({...notes, seenVersion: notes.build.appVersion});
  }
}
