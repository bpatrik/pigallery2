import {Injectable} from '@angular/core';
import {ParentDirectoryDTO,} from '../../../../common/entities/DirectoryDTO';
import {Utils} from '../../../../common/Utils';
import {Config} from '../../../../common/config/public/Config';
import {IAutoCompleteItem} from '../../../../common/entities/AutoCompleteItem';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {GroupingMethod, SortingMethod} from '../../../../common/entities/SortingMethods';
import {VersionService} from '../../model/version.service';
import {SearchQueryDTO, SearchQueryTypes,} from '../../../../common/entities/SearchQueryDTO';
import {ContentWrapper} from '../../../../common/entities/ConentWrapper';
import {ContentWrapperWithError} from './contentLoader.service';
import {ThemeModes} from '../../../../common/config/public/ClientConfig';
import {GridSizes} from '../../../../common/entities/GridSizes';

interface CacheItem<T> {
  timestamp: number;
  item: T;
}

@Injectable()
export class GalleryCacheService {
  private static readonly CONTENT_PREFIX = 'CONTENT:';
  private static readonly AUTO_COMPLETE_PREFIX = 'AUTOCOMPLETE:';
  private static readonly INSTANT_SEARCH_PREFIX = 'INSTANT_SEARCH:';
  private static readonly SEARCH_PREFIX = 'SEARCH:';
  private static readonly SORTING_PREFIX = 'SORTING:';
  private static readonly GROUPING_PREFIX = 'GROUPING:';
  private static readonly GRID_SIZE_PREFIX = 'GRID_SIZE:';
  private static readonly VERSION = 'VERSION';
  private static readonly SLIDESHOW_SPEED = 'SLIDESHOW_SPEED';
  private static THEME_MODE = 'THEME_MODE';

  constructor(private versionService: VersionService) {
    // if it was a forced reload not a navigation, clear cache
    if (GalleryCacheService.wasAReload()) {
      GalleryCacheService.deleteCache();
    }

    const onNewVersion = (ver: string) => {
      if (
          ver !== null &&
          localStorage.getItem(GalleryCacheService.VERSION) !== ver
      ) {
        GalleryCacheService.deleteCache();
        localStorage.setItem(GalleryCacheService.VERSION, ver);
      }
    };
    this.versionService.version.subscribe(onNewVersion);
    onNewVersion(this.versionService.version.value);
  }

  private static wasAReload(): boolean {
    const perfEntries = performance.getEntriesByType(
        'navigation'
    ) as PerformanceNavigationTiming[];
    return perfEntries && perfEntries[0] && perfEntries[0].type === 'reload';
  }

  private static loadCacheItem(key: string): ContentWrapperWithError {
    const tmp = localStorage.getItem(key);
    if (tmp != null) {
      const value: CacheItem<ContentWrapperWithError> = JSON.parse(tmp);
      if (
          value.timestamp <
          Date.now() - Config.Search.searchCacheTimeout
      ) {
        localStorage.removeItem(key);
        return null;
      }
      return value.item;
    }

    return null;
  }

  private static deleteCache(): void {
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        if (
            localStorage.key(i).startsWith(GalleryCacheService.CONTENT_PREFIX) ||
            localStorage.key(i).startsWith(GalleryCacheService.SEARCH_PREFIX) ||
            localStorage
                .key(i)
                .startsWith(GalleryCacheService.INSTANT_SEARCH_PREFIX) ||
            localStorage
                .key(i)
                .startsWith(GalleryCacheService.AUTO_COMPLETE_PREFIX)
        ) {
          toRemove.push(localStorage.key(i));
        }
      }

      for (const item of toRemove) {
        localStorage.removeItem(item);
      }
    } catch (e) {
      // ignoring errors
    }
  }

  public getGrouping(cw: ContentWrapper): GroupingMethod {
    return this.getSortOrGroup(GalleryCacheService.GROUPING_PREFIX, cw) as GroupingMethod;
  }

  public getSorting(cw: ContentWrapper): SortingMethod {
    return this.getSortOrGroup(GalleryCacheService.SORTING_PREFIX, cw) as SortingMethod;
  }

  public setGrouping(cw: ContentWrapper, sorting: GroupingMethod): void {
    return this.setSortOrGroup(GalleryCacheService.GROUPING_PREFIX, cw, sorting);
  }

  public setSorting(cw: ContentWrapper,
                    sorting: SortingMethod): void {
    return this.setSortOrGroup(GalleryCacheService.SORTING_PREFIX, cw, sorting);
  }

  public removeGrouping(cw: ContentWrapper): void {
    return this.removeSortOrGroup(GalleryCacheService.GROUPING_PREFIX, cw);
  }

  public removeSorting(cw: ContentWrapper): void {
    return this.removeSortOrGroup(GalleryCacheService.SORTING_PREFIX, cw);
  }


  private getSortOrGroup(prefix: string, cw: ContentWrapper): SortingMethod | GroupingMethod {
    let key = prefix;
    if (cw?.searchResult?.searchQuery) {
      key += JSON.stringify(cw.searchResult.searchQuery);
    } else {
      key += cw?.directory?.path + '/' + cw?.directory?.name;
    }
    const tmp = localStorage.getItem(key);
    if (tmp != null) {
      return JSON.parse(tmp);
    }
    return null;
  }


  private removeSortOrGroup(prefix: string, cw: ContentWrapper): void {
    try {
      let key = GalleryCacheService.SORTING_PREFIX;
      if (cw?.searchResult?.searchQuery) {
        key += JSON.stringify(cw.searchResult.searchQuery);
      } else {
        key += cw?.directory?.path + '/' + cw?.directory?.name;
      }
      localStorage.removeItem(key);
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }

  private setSortOrGroup(
      prefix: string,
      cw: ContentWrapper,
      sorting: SortingMethod | GroupingMethod
  ): void {
    try {
      let key = prefix;
      if (cw?.searchResult?.searchQuery) {
        key += JSON.stringify(cw.searchResult.searchQuery);
      } else {
        key += cw?.directory?.path + '/' + cw?.directory?.name;
      }
      localStorage.setItem(key, JSON.stringify(sorting));
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }

  removeGridSize(cw: ContentWrapperWithError): void {
    let key = GalleryCacheService.GRID_SIZE_PREFIX;
    if (cw?.searchResult?.searchQuery) {
      key += JSON.stringify(cw.searchResult.searchQuery);
    } else {
      key += cw?.directory?.path + '/' + cw?.directory?.name;
    }
    localStorage.removeItem(key);
  }

  getGridSize(cw: ContentWrapperWithError): GridSizes {
    let key = GalleryCacheService.GRID_SIZE_PREFIX;
    if (cw?.searchResult?.searchQuery) {
      key += JSON.stringify(cw.searchResult.searchQuery);
    } else {
      key += cw?.directory?.path + '/' + cw?.directory?.name;
    }
    const tmp = localStorage.getItem(key);
    if (tmp != null) {
      return parseInt(tmp);
    }
    return null;
  }

  setGridSize(cw: ContentWrapperWithError, gs: GridSizes) {
    try {
      let key = GalleryCacheService.GRID_SIZE_PREFIX;
      if (cw?.searchResult?.searchQuery) {
        key += JSON.stringify(cw.searchResult.searchQuery);
      } else {
        key += cw?.directory?.path + '/' + cw?.directory?.name;
      }
      localStorage.setItem(key, gs.toString());
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }

  public getAutoComplete(
      text: string,
      type: SearchQueryTypes
  ): IAutoCompleteItem[] {
    if (Config.Gallery.enableCache === false) {
      return null;
    }
    const key =
        GalleryCacheService.AUTO_COMPLETE_PREFIX +
        text +
        (type ? '_' + type : '');
    const tmp = localStorage.getItem(key);
    if (tmp != null) {
      const value: CacheItem<IAutoCompleteItem[]> = JSON.parse(tmp);
      if (
          value.timestamp <
          Date.now() - Config.Search.AutoComplete.cacheTimeout
      ) {
        localStorage.removeItem(key);
        return null;
      }
      return value.item;
    }
    return null;
  }

  public setAutoComplete(
      text: string,
      type: SearchQueryTypes,
      items: Array<IAutoCompleteItem>
  ): void {
    if (Config.Gallery.enableCache === false) {
      return;
    }
    const key =
        GalleryCacheService.AUTO_COMPLETE_PREFIX +
        text +
        (type ? '_' + type : '');
    const tmp: CacheItem<Array<IAutoCompleteItem>> = {
      timestamp: Date.now(),
      item: items,
    };
    try {
      localStorage.setItem(key, JSON.stringify(tmp));
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }

  public getSearch(query: SearchQueryDTO): ContentWrapperWithError {
    if (Config.Gallery.enableCache === false) {
      return null;
    }
    if (typeof query === 'string') {
      throw new Error('query expected to by object. Got:' + query);
    }
    const key = GalleryCacheService.SEARCH_PREFIX + JSON.stringify(query);
    return GalleryCacheService.loadCacheItem(key);
  }

  public setSearch(cw: ContentWrapperWithError): void {
    if (Config.Gallery.enableCache === false) {
      return;
    }
    const tmp: CacheItem<ContentWrapperWithError> = {
      timestamp: Date.now(),
      item: cw,
    };
    const key = GalleryCacheService.SEARCH_PREFIX + JSON.stringify(cw.searchResult.searchQuery);
    try {
      localStorage.setItem(key, JSON.stringify(tmp));
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }

  public getDirectory(directoryName: string): ContentWrapperWithError {
    if (Config.Gallery.enableCache === false) {
      return null;
    }
    try {
      const value = localStorage.getItem(
          GalleryCacheService.CONTENT_PREFIX + Utils.concatUrls(directoryName)
      );
      if (value != null) {
        return JSON.parse(value);
      }
    } catch (e) {
      // ignoring errors
    }
    return new ContentWrapperWithError();
  }

  public setDirectory(cw: ContentWrapper): void {
    if (Config.Gallery.enableCache === false) {
      return;
    }

    const key =
        GalleryCacheService.CONTENT_PREFIX +
        Utils.concatUrls(cw.directory.path, cw.directory.name);
    if (cw.directory.isPartial === true && localStorage.getItem(key)) {
      return;
    }

    try {
      // try to fit it
      localStorage.setItem(key, JSON.stringify(cw));
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }

  /**
   * Update media state at cache too (Eg.: thumbnail rendered)
   * @param media: MediaBaseDTO
   */
  public mediaUpdated(media: MediaDTO): void {
    if (Config.Gallery.enableCache === false) {
      return;
    }

    try {
      const directoryKey =
          GalleryCacheService.CONTENT_PREFIX +
          Utils.concatUrls(media.directory.path, media.directory.name);
      const value = localStorage.getItem(directoryKey);
      if (value != null) {
        const directory: ParentDirectoryDTO = JSON.parse(value);
        directory?.media?.forEach((p) => {
          if (p.name === media.name) {
            // update data
            p.metadata = media.metadata;
            if (media.missingThumbnails) {
              p.missingThumbnails = media.missingThumbnails;
            } else {
              delete p.missingThumbnails;
            }

            // save changes
            localStorage.setItem(directoryKey, JSON.stringify(directory));
            return;
          }
        });
      }
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }

  private reset(): void {
    try {
      const currentUserStr = localStorage.getItem('currentUser');
      localStorage.clear();
      localStorage.setItem('currentUser', currentUserStr);
      localStorage.setItem(
          GalleryCacheService.VERSION,
          this.versionService.version.value
      );
    } catch (e) {
      // ignoring errors
    }
  }

  getSlideshowSpeed(): number {
    const key = GalleryCacheService.SLIDESHOW_SPEED;
    const tmp = localStorage.getItem(key);
    if (tmp != null) {
      return parseInt(tmp, 10);
    }
    return null;
  }

  setSlideshowSpeed(speed: number): void {
    try {
      const key = GalleryCacheService.SLIDESHOW_SPEED;
      localStorage.setItem(key, speed.toString());
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }

  getThemeMode(): ThemeModes {
    const key = GalleryCacheService.THEME_MODE;
    const tmp = localStorage.getItem(key) as keyof typeof ThemeModes;
    if (tmp != null) {
      return ThemeModes[tmp];
    }
    return null;
  }


  setThemeMode(mode: ThemeModes): void {
    try {
      const key = GalleryCacheService.THEME_MODE;
      localStorage.setItem(key, ThemeModes[mode]);
    } catch (e) {
      this.reset();
      console.error(e);
    }
  }
}
