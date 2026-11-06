import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {GallerySortingService} from './sorting.service';
import {GalleryCacheService} from '../cache.gallery.service';
import {ContentLoaderService} from '../contentLoader.service';
import {ContentWrapper, ContentWrapperWithError} from '../../../../../common/entities/ContentWrapper';
import {GroupByTypes, GroupingMethod, SortByTypes, SortingMethod} from '../../../../../common/entities/SortingMethods';
import {Config} from '../../../../../common/config/public/Config';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {DirectoryContent} from '../contentLoader.service';

// stores the sorting and grouping per folder, like the localStorage based cache
class FakeGalleryCacheService {
  sorting = new Map<string, SortingMethod>();
  grouping = new Map<string, GroupingMethod>();

  private static key(cw: ContentWrapper): string {
    return cw?.directory?.path + '/' + cw?.directory?.name;
  }

  getSorting(cw: ContentWrapper): SortingMethod | null {
    return this.sorting.get(FakeGalleryCacheService.key(cw)) ?? null;
  }

  getGrouping(cw: ContentWrapper): GroupingMethod | null {
    return this.grouping.get(FakeGalleryCacheService.key(cw)) ?? null;
  }

  setSorting(cw: ContentWrapper, s: SortingMethod): void {
    this.sorting.set(FakeGalleryCacheService.key(cw), s);
  }

  setGrouping(cw: ContentWrapper, g: GroupingMethod): void {
    this.grouping.set(FakeGalleryCacheService.key(cw), g);
  }

  removeSorting(cw: ContentWrapper): void {
    this.sorting.delete(FakeGalleryCacheService.key(cw));
  }

  removeGrouping(cw: ContentWrapper): void {
    this.grouping.delete(FakeGalleryCacheService.key(cw));
  }
}

const folder = (name: string, metaFile: { name: string }[] = []): ContentWrapperWithError =>
  ({directory: {name, path: './', metaFile}} as unknown as ContentWrapperWithError);

const media = (name: string, creationDate: number, rating = 0): MediaDTO =>
  ({name, metadata: {creationDate, rating, size: {width: 10, height: 10}}} as unknown as MediaDTO);

describe('GallerySortingService', () => {
  let service: GallerySortingService;
  let cache: FakeGalleryCacheService;
  let content: ReturnType<typeof signal<ContentWrapperWithError>>;

  beforeEach(() => {
    content = signal(folder('Őszi kirándulás'));
    TestBed.configureTestingModule({
      providers: [
        {provide: GalleryCacheService, useClass: FakeGalleryCacheService},
        {provide: ContentLoaderService, useValue: {content}}
      ]
    });
    service = TestBed.inject(GallerySortingService);
    cache = TestBed.inject(GalleryCacheService) as unknown as FakeGalleryCacheService;
  });

  describe('sorting and grouping of the content', () => {
    it('should use the default for a folder without saved sorting', () => {
      expect(service.sorting()).toEqual(Config.Gallery.NavBar.SortingGrouping.defaultPhotoSortingMethod);
      expect(service.grouping()).toEqual(Config.Gallery.NavBar.SortingGrouping.defaultPhotoGroupingMethod);
    });

    it('should use the sorting of the folder\'s .pg2conf file', () => {
      content.set(folder('Balaton', [{name: '.order_descending_name.pg2conf'}]));
      expect(service.sorting()).toEqual({method: SortByTypes.Name, ascending: false});
    });

    it('should save the chosen sorting for the folder and restore it', () => {
      const byName = {method: SortByTypes.Name, ascending: true};
      service.setSorting(byName);
      expect(service.sorting()).toEqual(byName);
      expect(cache.getSorting(folder('Őszi kirándulás'))).toEqual(byName);

      // another folder gets its own (default) sorting
      content.set(folder('Balaton'));
      expect(service.sorting()).toEqual(Config.Gallery.NavBar.SortingGrouping.defaultPhotoSortingMethod);

      // back to the first folder
      content.set(folder('Őszi kirándulás'));
      expect(service.sorting()).toEqual(byName);
    });

    it('should forget the saved sorting when the default is chosen again', () => {
      service.setSorting({method: SortByTypes.Name, ascending: true});
      service.setSorting(service.getDefaultSorting(content()));
      expect(cache.getSorting(content())).toBeNull();
    });

    it('should save the chosen grouping for the folder', () => {
      const noGrouping = {method: GroupByTypes.NoGrouping, ascending: true};
      service.setGrouping(noGrouping);
      content.set(folder('Balaton'));
      expect(service.grouping()).toEqual(Config.Gallery.NavBar.SortingGrouping.defaultPhotoGroupingMethod);
      content.set(folder('Őszi kirándulás'));
      expect(service.grouping()).toEqual(noGrouping);
    });

    it('should use the search defaults for a search result', () => {
      content.set({searchResult: {searchQuery: {}}} as unknown as ContentWrapperWithError);
      expect(service.sorting()).toEqual(Config.Gallery.NavBar.SortingGrouping.defaultSearchSortingMethod);
      expect(service.grouping()).toEqual(Config.Gallery.NavBar.SortingGrouping.defaultSearchGroupingMethod);
    });
  });

  describe('applySorting', () => {
    const noGrouping = {method: GroupByTypes.NoGrouping, ascending: true};
    const names = (dc: DirectoryContent, s: SortingMethod, g: GroupingMethod = noGrouping): string[][] =>
      service.applySorting({...dc, media: [...dc.media]}, s, g)!.mediaGroups.map((mg) => mg.media.map((m) => m.name));

    const day = 24 * 60 * 60 * 1000;
    const dc: DirectoryContent = {
      directories: [],
      metaFile: [],
      media: [
        media('Őszi 10.jpg', Date.UTC(2025, 9, 2), 5),
        media('Őszi 2.jpg', Date.UTC(2025, 9, 1), 1),
        media('Ágnes.jpg', Date.UTC(2025, 9, 1) + day / 2, 3),
      ]
    };

    it('should return null without content', () => {
      expect(service.applySorting(undefined, {method: SortByTypes.Name, ascending: true}, noGrouping)).toBeNull();
    });

    it('should sort by name with numbers in order', () => {
      expect(names(dc, {method: SortByTypes.Name, ascending: true})).toEqual([['Ágnes.jpg', 'Őszi 2.jpg', 'Őszi 10.jpg']]);
      expect(names(dc, {method: SortByTypes.Name, ascending: false})).toEqual([['Őszi 10.jpg', 'Őszi 2.jpg', 'Ágnes.jpg']]);
    });

    it('should sort by rating', () => {
      expect(names(dc, {method: SortByTypes.Rating, ascending: true})).toEqual([['Őszi 2.jpg', 'Ágnes.jpg', 'Őszi 10.jpg']]);
    });

    it('should group by day and sort inside the groups', () => {
      const groups = names(dc, {method: SortByTypes.Name, ascending: true}, {method: GroupByTypes.Date, ascending: true});
      expect(groups).toEqual([['Ágnes.jpg', 'Őszi 2.jpg'], ['Őszi 10.jpg']]);
    });

    it('should shuffle the same way for the same content', () => {
      const random = {method: SortByTypes.Random, ascending: null} as SortingMethod;
      const first = names(dc, random);
      expect([...first[0]].sort()).toEqual(dc.media.map((m) => m.name).sort());
      expect(names(dc, random)).toEqual(first);
    });
  });
});
