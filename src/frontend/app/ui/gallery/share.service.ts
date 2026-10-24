import {Injectable} from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {
  CreateSharingDTO,
  PublicSharingDTO,
  ResponseSharingDTO,
} from '../../../../common/entities/SharingDTO';
import {Router, RoutesRecognized} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {distinctUntilChanged, filter} from 'rxjs/operators';
import {QueryParams} from '../../../../common/QueryParams';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {Utils} from '../../../../common/Utils';
import {Config} from '../../../../common/config/public/Config';
import {DirectorySearch, SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../common/SearchQueryUtils';


@Injectable()
export class ShareService {
  public readonly UnknownSharingKey = {
    sharingKey: 'UnknownSharingKey'
  } as ResponseSharingDTO;
  param: string = null;
  queryParam: string = null;
  sharingKey: string = null;
  inited = false;
  public ReadyPR: Promise<void>;
  public sharingSubject: BehaviorSubject<ResponseSharingDTO> = new BehaviorSubject(
    null
  );
  public sharingIsValid: BehaviorSubject<boolean> = new BehaviorSubject(
    null
  );
  public currentSharing = this.sharingSubject
    .asObservable()
    .pipe(filter((s) => s !== null))
    .pipe(distinctUntilChanged());

  private resolve: () => void;
  public publicSharingSubject: BehaviorSubject<PublicSharingDTO> = new BehaviorSubject(
    null
  );

  constructor(private networkService: NetworkService, private router: Router) {
    this.ReadyPR = new Promise((resolve: () => void) => {
      if (this.inited === true) {
        return resolve();
      }
      this.resolve = resolve;
    });

    this.router.events.subscribe(async (val) => {
      if (val instanceof RoutesRecognized) {
        this.param =
          val.state.root.firstChild.params[
            QueryParams.gallery.sharingKey_params
            ] || null;
        this.queryParam =
          val.state.root.firstChild.queryParams[
            QueryParams.gallery.sharingKey_query
            ] || null;

        const changed = this.sharingKey !== (this.param || this.queryParam);
        if (changed) {
          this.sharingKey = this.param || this.queryParam || this.sharingKey;
          await this.checkSharing();
        }
        if (this.resolve) {
          this.resolve();
          this.resolve = null;
          this.inited = true;
        }
      }
    });
    this.currentSharing.subscribe((sharing) => console.log('sharing', sharing));
  }

  public getUrl(share: ResponseSharingDTO): string {
    return Utils.concatUrls(Utils.getPublicBaseUrl(Config.Server.publicUrl, Config.Server.urlBase), '/share/', share.sharingKey);
  }


  onNewUser = async (user: UserDTO) => {
    // if this is a sharing user or a logged-in user, get sharing key
    if (user?.usedSharingKey || user?.role > UserRoles.LimitedGuest) {
      if (
        (user?.usedSharingKey &&
          user?.usedSharingKey !== this.sharingKey) ||
        this.sharingSubject.value == null
      ) {
        this.sharingKey = user.usedSharingKey || this.getSharingKey();
        if (!this.sharingKey) { //no key to fetch
          return;
        }
        await this.getSharing();
      }
      if (this.resolve) {
        this.resolve();
        this.resolve = null;
        this.inited = true;
      }
    }
  };

  public wait(): Promise<void> {
    if (this.inited) {
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
    password: string,
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
    password: string,
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
    password: string,
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
    password: string,
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
  public getDefaultRoute(sharing: ResponseSharingDTO): string[] {
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
    password: string,
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
    password: string,
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

  public getSharingKey(): string {
    return this.sharingKey;
  }

  public isSharing(): boolean {
    return this.sharingKey != null;
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
      this.sharingSubject.next(null);
      const sharing = await this.networkService.getJson<ResponseSharingDTO>(
        '/share/' + this.getSharingKey()
      );
      this.sharingSubject.next(sharing);
    } catch (e) {
      this.sharingSubject.next(this.UnknownSharingKey);
      console.error(e);
    }
  }

  /**
   * Leaves the current sharing (e.g.: on logout). The app behaves as if it was opened without a sharing link.
   */
  public dropSharing(): void {
    this.sharingKey = null;
    this.param = null;
    this.queryParam = null;
    this.sharingSubject.next(null);
    this.publicSharingSubject.next(null);
    this.sharingIsValid.next(null);
  }

  /**
   * Returns the public info of the current sharing (null if the sharing is not valid).
   * It is only loaded on navigation when the sharing key changes, so it might not be loaded yet
   * (e.g.: the sharing key comes from the session user after a page reload).
   */
  public async getPublicSharing(): Promise<PublicSharingDTO> {
    if (this.publicSharingSubject.value === null) {
      await this.checkSharing();
    }
    return this.publicSharingSubject.value;
  }

  private async checkSharing(): Promise<void> {
    try {
      this.sharingIsValid.next(null);
      const sharing = await this.networkService.getJson<PublicSharingDTO>(
        '/share/' + this.getSharingKey() + '/publicInfo'
      );
      const valid = sharing.sharingKey === this.getSharingKey();
      this.sharingIsValid.next(valid);
      if (valid) {
        this.publicSharingSubject.next(sharing);
      } else {
        this.publicSharingSubject.next(null);
      }
    } catch (e) {
      this.sharingIsValid.next(false);
      console.error(e);
    }
  }
}
