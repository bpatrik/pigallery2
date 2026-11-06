import { Injectable, computed, inject, signal } from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {NetworkService} from '../../model/network/network.service';
import {ContentWrapperUtils, ContentWrapperWithError, PackedContentWrapperWithError} from '../../../../common/entities/ContentWrapper';
import {SubDirectoryDTO,} from '../../../../common/entities/DirectoryDTO';
import {GalleryCacheService} from './cache.gallery.service';
import {EMPTY, firstValueFrom, from, Subject, timer} from 'rxjs';
import {Config} from '../../../../common/config/public/Config';
import {ShareService} from './share.service';
import {QueryParams} from '../../../../common/QueryParams';
import {ErrorCodes, ErrorDTO} from '../../../../common/entities/Error';
import {Router} from '@angular/router';
import {filter, startWith, switchMap} from 'rxjs/operators';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {FileDTO} from '../../../../common/entities/FileDTO';
import {GalleryService} from './gallery.service';
import {SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';

@Injectable({providedIn: 'root'})
export class ContentLoaderService {
  private networkService = inject(NetworkService);
  private galleryCacheService = inject(GalleryCacheService);
  private shareService = inject(ShareService);
  private galleryService = inject(GalleryService);
  private router = inject(Router);

  public readonly content = signal<ContentWrapperWithError>({} as ContentWrapperWithError);
  public readonly originalContent = computed((): DirectoryContent | undefined => {
    const c = this.content();
    return (c?.directory ? c.directory : c?.searchResult) ?? undefined;
  });
  private ongoingContentRequest: string | null = null;
  // directories that answered 'not found' since the last successfully loaded directory (avoids redirect loops)
  private readonly notFoundDirectories = new Set<string>();
  private lastContentRequest: { type: 'directory' | 'search', value: string } | null = null;
  private pollingTimerRestart = new Subject<void>();

  constructor() {
    this.setupAutoUpdate();
  }

  setupAutoUpdate() {
    // polling is time based, so it stays a stream
    toObservable(this.galleryService.autoPollIntervalS).pipe(
      switchMap(interval => {
        if (!interval) {
          return EMPTY; // stop polling
        }

        // Start polling or restart when pollingTimerRestart emits
        return this.pollingTimerRestart.pipe(
          startWith(void 0),
          switchMap(() =>
            timer(
              interval * 1000,
              interval * 1000
            ).pipe(
              filter(() => this.ongoingContentRequest === null),
              switchMap(() => from(this.reloadCurrentContent()))
            )
          )
        );
      })
    ).pipe(takeUntilDestroyed()).subscribe({
      error: err => console.error(err)
    });
  }

  setContent(content: ContentWrapperWithError): void {
    if (ContentWrapperUtils.equals(this.content(), content)) {
      return;
    }
    this.content.set(content);
  }

  public async loadDirectory(directoryName: string, forceReload = false): Promise<void> {

    // load from cache
    const cachedCw = this.galleryCacheService.getDirectory(directoryName);

    this.setContent(ContentWrapperUtils.unpack(cachedCw));
    this.ongoingContentRequest = directoryName;
    this.lastContentRequest = {type: 'directory', value: directoryName};

    // prepare server request
    const params: Record<string, unknown> = {};
    if (Config.Sharing.enabled === true) {
      if (this.shareService.isSharing()) {
        params[QueryParams.gallery.sharingKey_query] =
          this.shareService.getSharingKey();
      }
    }
    let cw: PackedContentWrapperWithError | null = null;

    try {
      if (
        !forceReload &&
        cachedCw?.directory &&
        cachedCw?.directory.lastModified &&
        cachedCw?.directory.lastScanned &&
        !cachedCw?.directory.isPartial
      ) {
        params[QueryParams.gallery.knownLastModified] =
          cachedCw?.directory.lastModified;
        params[QueryParams.gallery.knownLastScanned] =
          cachedCw?.directory.lastScanned;
      }

      cw = await this.networkService.getJson<PackedContentWrapperWithError>(
        '/gallery/content/' + encodeURIComponent(directoryName),
        params
      );
    } catch (e) {
      if ((e as ErrorDTO)?.code === ErrorCodes.DIRECTORY_NOT_FOUND) {
        if (this.ongoingContentRequest === directoryName) {
          this.ongoingContentRequest = null;
          await this.onDirectoryNotFound(directoryName);
        }
        return;
      }
      console.error(e);
    }
    if (this.ongoingContentRequest !== directoryName) {
      return;
    }
    this.ongoingContentRequest = null;
    this.pollingTimerRestart.next();

    if (!cw || cw.notModified === true) {
      return;
    }

    if (cw?.directory) {
      this.notFoundDirectories.clear();
      this.galleryCacheService.setDirectory(cw); // save it before adding references
    }
    this.setContent(ContentWrapperUtils.unpack(cw));

  }

  /**
   * The directory does not exist or the user can't access it.
   * Navigates to the default view, unless that was not found either (avoids redirect loops).
   */
  private async onDirectoryNotFound(directoryName: string): Promise<void> {
    const normalize = (d: string) => (d || '').replace(/\\/g, '/').split('/').filter(s => s !== '' && s !== '.').join('/');
    this.notFoundDirectories.add(normalize(directoryName));

    let route: string[] | null;
    if (this.shareService.isSharing()) {
      // the sharing loads in parallel with the content, so the 404 can arrive first
      const sharing = this.shareService.sharing() ?? await firstValueFrom(this.shareService.currentSharing);
      route = this.shareService.getDefaultRoute(sharing);
    } else {
      route = ['/gallery', ''];
    }
    const isNotFoundDirectory = route && route[0] === '/gallery' && this.notFoundDirectories.has(normalize(route[1]));
    if (!route || isNotFoundDirectory) {
      this.setContent({error: $localize`Directory not found`} as ContentWrapperWithError);
      return;
    }
    const queryParams: Record<string, string> = {};
    const sharingKey = this.shareService.getSharingKey();
    if (this.shareService.isSharing() && sharingKey) {
      queryParams[QueryParams.gallery.sharingKey_query] = sharingKey;
    }
    await this.router.navigate(route, {queryParams});
  }

  public async search(query: SearchQueryDTO, forceReload = false): Promise<void> {
    const queryStr = JSON.stringify(query);
    this.ongoingContentRequest = queryStr;
    this.lastContentRequest = {type: 'search', value: queryStr};

    if (!forceReload) {
      this.setContent({} as PackedContentWrapperWithError); // don't empty the page when its just a reload
    }

    let cw = this.galleryCacheService.getSearch(query);
    if (forceReload || (!cw || cw.searchResult == null)) {
      try {
        cw = await this.networkService.getJson<PackedContentWrapperWithError>('/search/' + encodeURIComponent(queryStr));
        this.galleryCacheService.setSearch(cw);
      } catch (e) {
        cw = cw || {
          directory: null,
          searchResult: null
        } as PackedContentWrapperWithError;
        if (e.code === ErrorCodes.LocationLookUp_ERROR) {
          cw.error = $localize`Cannot find location` + ': ' + e.message;
        } else {
          cw.error = $localize`Unknown server error` + ': ' + e.message;
        }
      }
    }

    if (this.ongoingContentRequest !== queryStr) {
      return;
    }
    this.ongoingContentRequest = null;
    this.pollingTimerRestart.next();

    this.setContent(ContentWrapperUtils.unpack(cw));
  }

  public readonly isSearchResult = computed((): boolean => !!this.content().searchResult);

  public async reloadCurrentContent(): Promise<void> {
    if (!this.lastContentRequest) {
      return;
    }

    if (this.lastContentRequest.type === 'directory') {
      await this.loadDirectory(this.lastContentRequest.value, true);
    } else if (this.lastContentRequest.type === 'search') {
      await this.search(JSON.parse(this.lastContentRequest.value), true);
    }
  }
}


export interface DirectoryContent {
  directories: SubDirectoryDTO[];
  media: MediaDTO[];
  metaFile: FileDTO[];
}
