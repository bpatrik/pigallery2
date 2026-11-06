import { Injectable, inject, signal } from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {NetworkService} from '../../model/network/network.service';
import {
  CreateSharingDTO,
  PublicSharingDTO,
  ResponseSharingDTO,
} from '../../../../common/entities/SharingDTO';
import {Router, RoutesRecognized} from '@angular/router';
import {distinctUntilChanged, filter} from 'rxjs/operators';
import {QueryParams} from '../../../../common/QueryParams';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {Utils} from '../../../../common/Utils';
import {Config} from '../../../../common/config/public/Config';
import {DirectorySearch, SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../common/SearchQueryUtils';


@Injectable({providedIn: 'root'})
export class ShareService {
  private networkService = inject(NetworkService);
  private router = inject(Router);

  public readonly UnknownSharingKey = {
    sharingKey: 'UnknownSharingKey'
  } as ResponseSharingDTO;
  param: string | null = null;
  queryParam: string | null = null;
  public readonly sharingKey = signal<string | null>(null);
  // true once the router read the sharing key of the first navigation (it might be none)
  public readonly routeRecognized = signal(false);
  // true once the sharing key is known (from the route or from the session user)
  public readonly ready = signal(false);
  public ReadyPR: Promise<void>;
  public readonly sharing = signal<ResponseSharingDTO | null>(null);
  public readonly sharingIsValid = signal<boolean | null>(null);
  // a stream, so it can be awaited until the sharing is loaded
  public currentSharing = toObservable(this.sharing)
    .pipe(filter((s) => s !== null))
    .pipe(distinctUntilChanged());

  private resolve: (() => void) | null = null;
  public readonly publicSharing = signal<PublicSharingDTO | null>(null);

  constructor() {
    this.ReadyPR = new Promise((resolve: () => void) => {
      if (this.ready()) {
        return resolve();
      }
      this.resolve = resolve;
    });

    this.router.events.subscribe(async (val) => {
      if (val instanceof RoutesRecognized) {
        this.param =
          val.state.root.firstChild?.params[
            QueryParams.gallery.sharingKey_params
            ] || null;
        this.queryParam =
          val.state.root.firstChild?.queryParams[
            QueryParams.gallery.sharingKey_query
            ] || null;

        const changed = this.sharingKey() !== (this.param || this.queryParam);
        if (changed) {
          this.sharingKey.set(this.param || this.queryParam || this.sharingKey());
        }
        this.routeRecognized.set(true);
        if (changed) {
          await this.checkSharing();
        }
        if (this.resolve) {
          this.resolve();
          this.resolve = null;
          this.ready.set(true);
        }
      }
    });
  }

  public getUrl(share: ResponseSharingDTO): string {
    return Config.Server.getPublicUrl('/share/', share.sharingKey);
  }


  onNewUser = async (user: UserDTO | null): Promise<void> => {
    // if this is a sharing user or a logged-in user, get sharing key
    if (user && (user.usedSharingKey || user.role > UserRoles.LimitedGuest)) {
      if (
        (user.usedSharingKey &&
          user.usedSharingKey !== this.sharingKey()) ||
        this.sharing() == null
      ) {
        this.sharingKey.set(user.usedSharingKey || this.getSharingKey());
        if (!this.sharingKey()) { //no key to fetch
          return;
        }
        await this.getSharing();
      }
      if (this.resolve) {
        this.resolve();
        this.resolve = null;
        this.ready.set(true);
      }
    }
  };

  public wait(): Promise<void> {
    if (this.ready()) {
      return Promise.resolve();
    }
    return this.ReadyPR;
  }

  private static validateDefaultViews(
    defaultDirectoryView?: string,
    defaultSearchView?: SearchQueryDTO
  ): void {
    if (defaultDirectoryView && defaultSearchView) {
      throw new Error(
        'defaultDirectoryView and defaultSearchView cannot be set at the same time'
      );
    }
  }

  public createSharing(
    dir: string,
    password: string | null,
    valid: number,
    defaultDirectoryView?: string,
    defaultSearchView?: SearchQueryDTO
  ): Promise<ResponseSharingDTO> {
    ShareService.validateDefaultViews(defaultDirectoryView, defaultSearchView);
    // Legacy dir-based API: backend will convert to strict directory searchQuery if searchQuery not provided
    return this.networkService.postJson('/share/' + dir, {
      createSharing: {
        valid,
        ...(!!password && {password: password}), // only add password if present
        ...(!!defaultDirectoryView && {defaultDirectoryView}),
        ...(!!defaultSearchView && {defaultSearchView}),
      } as CreateSharingDTO,
    });
  }

  public createSharingByQuery(
    searchQuery: SearchQueryDTO,
    password: string | null,
    valid: number,
    defaultDirectoryView?: string,
    defaultSearchView?: SearchQueryDTO
  ): Promise<ResponseSharingDTO> {
    ShareService.validateDefaultViews(defaultDirectoryView, defaultSearchView);
    return this.networkService.postJson('/share/', {
      createSharing: {
        valid,
        ...(!!password && {password: password}),
        searchQuery,
        ...(!!defaultDirectoryView && {defaultDirectoryView}),
        ...(!!defaultSearchView && {defaultSearchView}),
      } as CreateSharingDTO,
    });
  }

  /**
   * Shares a directory (and its photos). The directory query is an exact match or a 'path/*' glob for recursive sharing.
   */
  public createSharingByDirectory(
    directoryQuery: DirectorySearch,
    password: string | null,
    valid: number,
    defaultDirectoryView?: string
  ): Promise<ResponseSharingDTO> {
    return this.networkService.postJson('/share/', {
      createSharing: {
        valid,
        ...(!!password && {password: password}),
        directoryQuery,
        ...(!!defaultDirectoryView && {defaultDirectoryView}),
      } as CreateSharingDTO,
    });
  }

  public updateSharingByDirectory(
    sharingId: number,
    directoryQuery: DirectorySearch,
    password: string | null,
    valid: number,
    defaultDirectoryView?: string
  ): Promise<ResponseSharingDTO> {
    return this.networkService.putJson('/share/', {
      updateSharing: {
        id: sharingId,
        valid,
        password,
        directoryQuery,
        ...(!!defaultDirectoryView && {defaultDirectoryView}),
      } as CreateSharingDTO,
    });
  }

  /**
   * Where the sharing should be opened: its default view, otherwise its search query or its directory.
   * Returns the router commands.
   */
  public getDefaultRoute(sharing: ResponseSharingDTO | null | undefined): string[] | null {
    if (sharing?.defaultDirectoryView) {
      return ['/gallery', sharing.defaultDirectoryView];
    }
    if (sharing?.defaultSearchView) {
      return ['/search', SearchQueryUtils.urlify(sharing.defaultSearchView)];
    }
    if (sharing?.searchQuery) {
      return ['/search', SearchQueryUtils.urlify(sharing.searchQuery)];
    }
    if (sharing?.directoryQuery) {
      // for recursive sharing ('path/*') open the directory itself
      return ['/gallery', Utils.canonizePath(sharing.directoryQuery.value).replace(/\/?\*$/, '')];
    }
    return null;
  }

  public updateSharing(
    dir: string,
    sharingId: number,
    password: string | null,
    valid: number,
    defaultDirectoryView?: string,
    defaultSearchView?: SearchQueryDTO
  ): Promise<ResponseSharingDTO> {
    ShareService.validateDefaultViews(defaultDirectoryView, defaultSearchView);
    // Legacy dir-based API: backend will convert to strict directory searchQuery if searchQuery not provided
    return this.networkService.putJson('/share/' + dir, {
      updateSharing: {
        id: sharingId,
        valid,
        password,
        ...(!!defaultDirectoryView && {defaultDirectoryView}),
        ...(!!defaultSearchView && {defaultSearchView}),
      } as CreateSharingDTO,
    });
  }

  public updateSharingByQuery(
    sharingId: number,
    searchQuery: SearchQueryDTO,
    password: string | null,
    valid: number,
    defaultDirectoryView?: string,
    defaultSearchView?: SearchQueryDTO
  ): Promise<ResponseSharingDTO> {
    ShareService.validateDefaultViews(defaultDirectoryView, defaultSearchView);
    return this.networkService.putJson('/share/', {
      updateSharing: {
        id: sharingId,
        valid,
        password,
        searchQuery,
        ...(!!defaultDirectoryView && {defaultDirectoryView}),
        ...(!!defaultSearchView && {defaultSearchView}),
      } as CreateSharingDTO,
    });
  }

  public getSharingKey(): string | null {
    return this.sharingKey();
  }

  public isSharing(): boolean {
    return this.sharingKey() != null;
  }

  public async getSharingListForQuery(
    query: SearchQueryDTO
  ): Promise<ResponseSharingDTO[]> {
    return this.networkService.getJson('/share/list/' + encodeURIComponent(JSON.stringify(query)));
  }

  public getSharingList(): Promise<ResponseSharingDTO[]> {
    if (!Config.Sharing.enabled) {
      return Promise.resolve([]);
    }
    return this.networkService.getJson('/share/listAll');
  }

  public deleteSharing(sharing: ResponseSharingDTO): Promise<void> {
    return this.networkService.deleteJson('/share/' + encodeURIComponent(sharing.sharingKey));
  }

  private async getSharing(): Promise<void> {
    try {
      this.sharing.set(null);
      const sharing = await this.networkService.getJson<ResponseSharingDTO>(
        '/share/' + this.getSharingKey()
      );
      this.sharing.set(sharing);
    } catch (e) {
      this.sharing.set(this.UnknownSharingKey);
      console.error(e);
    }
  }

  /**
   * Leaves the current sharing (e.g.: on logout). The app behaves as if it was opened without a sharing link.
   */
  public dropSharing(): void {
    this.sharingKey.set(null);
    this.param = null;
    this.queryParam = null;
    this.sharing.set(null);
    this.publicSharing.set(null);
    this.sharingIsValid.set(null);
  }

  /**
   * Returns the public info of the current sharing (null if the sharing is not valid).
   * It is only loaded on navigation when the sharing key changes, so it might not be loaded yet
   * (e.g.: the sharing key comes from the session user after a page reload).
   */
  public async getPublicSharing(): Promise<PublicSharingDTO | null> {
    if (this.publicSharing() === null) {
      await this.checkSharing();
    }
    return this.publicSharing();
  }

  private async checkSharing(): Promise<void> {
    try {
      this.sharingIsValid.set(null);
      const sharing = await this.networkService.getJson<PublicSharingDTO>(
        '/share/' + this.getSharingKey() + '/publicInfo'
      );
      const valid = sharing.sharingKey === this.getSharingKey();
      this.sharingIsValid.set(valid);
      if (valid) {
        this.publicSharing.set(sharing);
      } else {
        this.publicSharing.set(null);
      }
    } catch (e) {
      this.sharingIsValid.set(false);
      console.error(e);
    }
  }
}
