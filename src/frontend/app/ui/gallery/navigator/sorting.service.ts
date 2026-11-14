import { Injectable, LOCALE_ID, inject, linkedSignal } from '@angular/core';
import {formatDate} from '@angular/common';
import {GalleryCacheService} from '../cache.gallery.service';
import {Config} from '../../../../../common/config/public/Config';
import {ScrollLabelModes} from '../../../../../common/config/public/ClientConfig';
import {GroupByTypes, GroupingMethod, SortByDirectionalTypes, SortByTypes, SortingMethod} from '../../../../../common/entities/SortingMethods';
import {PG2ConfMap} from '../../../../../common/PG2ConfMap';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {SeededRandomService} from '../../../model/seededRandom.service';
import {ContentWrapper} from '../../../../../common/entities/ContentWrapper';
import {SubDirectoryDTO} from '../../../../../common/entities/DirectoryDTO';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {FileDTO} from '../../../../../common/entities/FileDTO';
import {Utils} from '../../../../../common/Utils';
import {ContentLoaderService, DirectoryContent} from '../contentLoader.service';

@Injectable({providedIn: 'root'})
export class GallerySortingService {
  private galleryCacheService = inject(GalleryCacheService);
  private galleryService = inject(ContentLoaderService);
  private rndService = inject(SeededRandomService);
  private locale = inject(LOCALE_ID);

  // the sorting and grouping saved for the content (or its default), until the user changes them
  public readonly sorting = linkedSignal<SortingMethod>(() => {
    const c = this.galleryService.content();
    return this.galleryCacheService.getSorting(c) ?? this.getDefaultSorting(c);
  });
  public readonly grouping = linkedSignal<GroupingMethod>(() => {
    const c = this.galleryService.content();
    return this.galleryCacheService.getGrouping(c) ?? this.getDefaultGrouping(c);
  });
  private collator = new Intl.Collator(undefined, {numeric: true});

  isDefaultSortingAndGrouping(cw: ContentWrapper): boolean {
    const defS = this.getDefaultSorting(cw);
    const defG = this.getDefaultGrouping(cw);
    const s = this.sorting();
    const g = this.grouping();
    return s.method === defS.method && s.ascending === defS.ascending &&
      g.method === defG.method && g.ascending === defG.ascending;
  }

  getDefaultSorting(cw: ContentWrapper): SortingMethod {
    if (cw?.directory && cw?.directory.metaFile) {
      for (const file in PG2ConfMap.sorting) {
        if (cw.directory.metaFile.some((f) => f.name === file)) {
          return (PG2ConfMap.sorting)[file];
        }
      }
    }
    if (cw?.searchResult) {
      return Config.Gallery.NavBar.SortingGrouping.defaultSearchSortingMethod;
    }
    return Config.Gallery.NavBar.SortingGrouping.defaultPhotoSortingMethod;
  }


  getDefaultGrouping(cw: ContentWrapper): GroupingMethod {
    if (cw?.searchResult) {
      return Config.Gallery.NavBar.SortingGrouping.defaultSearchGroupingMethod;
    }
    return Config.Gallery.NavBar.SortingGrouping.defaultPhotoGroupingMethod;
  }

  setSorting(sorting: SortingMethod): void {
    this.sorting.set(sorting);
    if (this.galleryService.content()) {
      if (
        sorting !==
        this.getDefaultSorting(this.galleryService.content())
      ) {
        this.galleryCacheService.setSorting(
          this.galleryService.content(),
          sorting
        );
      } else {
        this.galleryCacheService.removeSorting(
          this.galleryService.content()
        );
      }
    }
  }

  setGrouping(grouping: GroupingMethod): void {
    this.grouping.set(grouping);
    if (this.galleryService.content()) {
      if (
        grouping !==
        this.getDefaultGrouping(this.galleryService.content())
      ) {
        this.galleryCacheService.setGrouping(
          this.galleryService.content(),
          grouping
        );
      } else {
        this.galleryCacheService.removeGrouping(
          this.galleryService.content()
        );
      }
    }
  }

  private compareByName(a: MediaDTO, b: MediaDTO): number {
    const aSortable = Utils.sortableFilename(a.name);
    const bSortable = Utils.sortableFilename(b.name);

    if (aSortable === bSortable) {
      // If the trimmed filenames match, use the full name as tie breaker
      // This preserves a consistent final position for files named e.g.,
      // 10.jpg and 10.png, even if their starting position in the list
      // changes based on any previous sorting that's happened under different heuristics
      return this.collator.compare(a.name, b.name);
    }

    return this.collator.compare(aSortable, bSortable);
  }

  /** The directory of the media relative to the gallery root, '.' for the root. It always uses '/', also on a Windows server. */
  private directoryPath(m: MediaDTO): string {
    return Utils.concatUrls(m.directory.path, m.directory.name);
  }

  private directoryName(path: string): string {
    return path === '.' ? $localize`Home` : path;
  }

  /**
   * Tree order: a directory comes right before its subdirectories (2020, 2020/Summer, 2021),
   * so the paths are compared segment by segment, not as one string.
   */
  private sortByDirectory(media: MediaDTO[]): void {
    const segments = new Map<MediaDTO, string[]>();
    for (const m of media) {
      const p = this.directoryPath(m);
      segments.set(m, p === '.' ? [] : p.split('/'));
    }
    media.sort((a: MediaDTO, b: MediaDTO): number => {
      const aS = segments.get(a)!;
      const bS = segments.get(b)!;
      for (let i = 0; i < Math.min(aS.length, bS.length); i++) {
        const c = this.collator.compare(aS[i], bS[i]);
        if (c !== 0) {
          return c;
        }
      }
      return (aS.length - bS.length) || this.compareByName(a, b);
    });
  }

  private sortMedia(sorting: SortingMethod | GroupingMethod, media: MediaDTO[]): void {
    if (!media) {
      return;
    }
    switch (sorting.method) {
      case SortByTypes.Name:
        media.sort((a: PhotoDTO, b: PhotoDTO) => this.compareByName(a, b));
        break;
      case SortByTypes.Directory:
        this.sortByDirectory(media);
        break;
      case SortByTypes.Date:
        media.sort((a: PhotoDTO, b: PhotoDTO): number => {
          return Utils.getTimeMS(a.metadata.creationDate, a.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset) - Utils.getTimeMS(b.metadata.creationDate, b.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset);
        });
        break;
      case SortByTypes.Rating:
        media.sort(
          (a: PhotoDTO, b: PhotoDTO) =>
            (a.metadata.rating || 0) - (b.metadata.rating || 0)
        );
        break;
      case SortByTypes.PersonCount:
        media.sort(
          (a: PhotoDTO, b: PhotoDTO) =>
            (a.metadata?.faces?.length || 0) - (b.metadata?.faces?.length || 0)
        );
        break;
      case SortByTypes.FileSize:
        media.sort(
          (a: PhotoDTO, b: PhotoDTO) =>
            (a.metadata?.fileSize || 0) - (b.metadata?.fileSize || 0)
        );
        break;
      case SortByTypes.Random:
        this.rndService.setSeed(media.length);
        for (let i = media.length - 1; i > 0; i--) {
          const j = Math.floor(this.rndService.get() * (i + 1));
          [media[i], media[j]] = [media[j], media[i]];
        }
        break;
    }
    if (!sorting.ascending) {
      media.reverse();
    }
    return;
  }

  private formatMediaDate(m: MediaDTO, format: string): string {
    if (Config.Gallery.ignoreTimestampOffset === true) {
      //Datepipe used this way, converts creationDate to date in local time.
      return formatDate(m.metadata.creationDate, format, this.locale, m.metadata.creationDateOffset ? m.metadata.creationDateOffset : 'UTC');
    }
    //Grouping with global time, requires a common timeframe.
    return formatDate(m.metadata.creationDate, format, this.locale, 'UTC');
  }

  private getGroupByNameFn(grouping: GroupingMethod) {
    switch (grouping.method) {
      case SortByTypes.Date:
        return (m: MediaDTO) => this.formatMediaDate(m, 'longDate');

      case SortByTypes.Name:
        // by the first letter without its accent (Á is in the A group), like the names sort
        return (m: MediaDTO) => (m.name.normalize('NFD').at(0) ?? '').toUpperCase();

      case SortByTypes.Directory:
        return (m: MediaDTO) => this.directoryPath(m);

      case SortByTypes.Rating:
        return (m: MediaDTO) => ((m as PhotoDTO).metadata.rating || 0).toString();

      case SortByTypes.FileSize: {
        const groups = [0.5, 1, 2, 5, 10, 15, 20, 30, 50, 100, 200, 500, 1000]; // MBs
        return (m: MediaDTO) => {
          const mbites = ((m as PhotoDTO).metadata.fileSize || 0) / 1024 / 1024;
          const i = groups.findIndex((s) => s > mbites);
          if (i == -1) {
            return '>' + groups[groups.length - 1] + ' MB';
          } else if (i == 0) {
            return '<' + groups[0] + ' MB';
          }
          return groups[i - 1] + ' - ' + groups[i] + ' MB';
        };
      }

      case SortByTypes.PersonCount:
        return (m: MediaDTO) => ((m as PhotoDTO).metadata.faces || []).length.toString();

    }
    return () => '';
  }

  /**
   * Returns the order the scroll indicator shows and the label of a media in it, or null if there should be no label.
   * The media are ordered by the grouping and only sorted within the groups,
   * so the label follows the grouping, or the sorting if there is no grouping.
   */
  public getScrollLabelFn(sorting: SortingMethod, grouping: GroupingMethod): ScrollLabelFn | null {
    const mode = Config.Gallery.NavBar.showScrollLabel;
    const method = grouping.method === GroupByTypes.NoGrouping ? sorting.method : grouping.method;
    if (mode === ScrollLabelModes.never || (mode === ScrollLabelModes.date && method !== SortByTypes.Date)) {
      return null;
    }
    switch (method) {
      case SortByTypes.Date:
        // coarser than the day of the group headers, but with the same time zone handling
        return {order: method, label: (m: MediaDTO) => m.metadata?.creationDate ? this.formatMediaDate(m, 'MMMM y') : ''};
      case SortByTypes.Directory:
        return {order: method, label: (m: MediaDTO) => this.directoryName(this.directoryPath(m))};
      case SortByTypes.Name:
      case SortByTypes.Rating:
      case SortByTypes.FileSize:
      case SortByTypes.PersonCount:
        return {order: method, label: this.getGroupByNameFn({method, ascending: true})};
    }
    return null;
  }

  public applySorting(
    dirContent: DirectoryContent | undefined,
    sorting: SortingMethod,
    grouping: GroupingMethod
  ): GroupedDirectoryContent | null {
    if (!dirContent) {
      return null;
    }
    const c: GroupedDirectoryContent = {
      mediaGroups: [],
      directories: dirContent.directories,
      metaFile: dirContent.metaFile,
    };
    if (c.directories) {
      switch (sorting.method) {
        case SortByTypes.FileSize:
        case SortByTypes.PersonCount:
        case SortByTypes.Rating: // directories do not have rating
        case SortByTypes.Directory:
        case SortByTypes.Name:
          c.directories.sort((a, b) =>
            this.collator.compare(a.name, b.name)
          );
          break;
        case SortByTypes.Date:
          if (
            Config.Gallery.enableDirectorySortingByDate === true
          ) {
            c.directories.sort(
              (a, b) => (a.cache?.oldestMedia || a.lastModified) - (b.cache?.oldestMedia || b.lastModified)
            );
            break;
          }
          c.directories.sort((a, b) =>
            this.collator.compare(a.name, b.name)
          );
          break;
        case SortByTypes.Random:
          this.rndService.setSeed(c.directories.length);
          for (let i = c.directories.length - 1; i > 0; i--) {
            const j = Math.floor(this.rndService.get() * (i + 1));
            [c.directories[i], c.directories[j]] = [c.directories[j], c.directories[i]];
          }
          break;
      }

      if (!sorting.ascending) {
        c.directories.reverse();
      }
    }

    // group
    if (dirContent.media) {
      const mCopy = dirContent.media;
      this.sortMedia(grouping, mCopy);
      const groupFN = this.getGroupByNameFn(grouping);

      c.mediaGroups = [];
      let lastKey: string | null = null;

      for (const m of mCopy) {
        const k = groupFN(m);
        // by the key, the name of the root directory is not its key
        if (lastKey !== k) {
          lastKey = k;
          c.mediaGroups.push(grouping.method === GroupByTypes.Directory ?
            {name: this.directoryName(k), directoryPath: k, media: []} :
            {name: k, media: []});
        }
        c.mediaGroups[c.mediaGroups.length - 1].media.push(m);
      }
    }

    if (grouping.method === GroupByTypes.Date) {
      // We do not need the youngest as we group by day. All photos are from the same day
      c.mediaGroups.forEach(g => {
        g.date = Utils.makeUTCMidnight(new Date(g.media?.[0]?.metadata?.creationDate), g.media?.[0]?.metadata?.creationDateOffset);
      });
    }

    // sort groups
    for (const group of c.mediaGroups) {
      this.sortMedia(sorting, group.media);
    }

    return c;
  }
}

// the order the scroll indicator shows (to show the label like the group headers do) and the label of a media in it
export interface ScrollLabelFn {
  order: SortByDirectionalTypes;
  label: (m: MediaDTO) => string;
}

export interface MediaGroup {
  name: string;
  date?: Date; // used for blog. It allows to chop off blog to smaller pieces
  directoryPath?: string; // the directory of the media, when grouped by directory
  media: MediaDTO[];
}

export interface GroupedDirectoryContent {
  directories: SubDirectoryDTO[];
  mediaGroups: MediaGroup[];
  metaFile: FileDTO[];
}
