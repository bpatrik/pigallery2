import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {GallerySortingService} from './sorting.service';
import {GalleryCacheService} from '../cache.gallery.service';
import {ContentLoaderService, DirectoryContent} from '../contentLoader.service';
import {ContentWrapper, ContentWrapperWithError} from '../../../../../common/entities/ContentWrapper';
import {GroupByTypes, GroupingMethod, SortByTypes, SortingMethod} from '../../../../../common/entities/SortingMethods';
import {Config} from '../../../../../common/config/public/Config';
import {ScrollLabelModes} from '../../../../../common/config/public/ClientConfig';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {SubDirectoryDTO} from '../../../../../common/entities/DirectoryDTO';

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

const detailedMedia = (name: string, creationDate: number, rating: number, faceCount: number, fileSize: number): MediaDTO =>
  ({
    name,
    metadata: {creationDate, rating, fileSize, faces: new Array(faceCount).fill({name: 'Jane Smith'}), size: {width: 10, height: 10}}
  } as unknown as MediaDTO);

describe('GallerySortingService', () => {
  let service: GallerySortingService;
  let cache: FakeGalleryCacheService;
  let content: ReturnType<typeof signal<ContentWrapperWithError>>;

  beforeEach(() => {
    content = signal(folder('Autumn trip'));
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
      content.set(folder('Lake', [{name: '.order_descending_name.pg2conf'}]));
      expect(service.sorting()).toEqual({method: SortByTypes.Name, ascending: false});
    });

    it('should save the chosen sorting for the folder and restore it', () => {
      const byName = {method: SortByTypes.Name, ascending: true};
      service.setSorting(byName);
      expect(service.sorting()).toEqual(byName);
      expect(cache.getSorting(folder('Autumn trip'))).toEqual(byName);

      // another folder gets its own (default) sorting
      content.set(folder('Lake'));
      expect(service.sorting()).toEqual(Config.Gallery.NavBar.SortingGrouping.defaultPhotoSortingMethod);

      // back to the first folder
      content.set(folder('Autumn trip'));
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
      content.set(folder('Lake'));
      expect(service.grouping()).toEqual(Config.Gallery.NavBar.SortingGrouping.defaultPhotoGroupingMethod);
      content.set(folder('Autumn trip'));
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
    // accents and numbers in the names on purpose: the name sorting must handle both
    const dc: DirectoryContent = {
      directories: [],
      metaFile: [],
      media: [
        media('Éclair 10.jpg', Date.UTC(2025, 9, 2), 5),
        media('Éclair 2.jpg', Date.UTC(2025, 9, 1), 1),
        media('Árvíztűrő.jpg', Date.UTC(2025, 9, 1) + day / 2, 3),
      ]
    };

    it('should return null without content', () => {
      expect(service.applySorting(undefined, {method: SortByTypes.Name, ascending: true}, noGrouping)).toBeNull();
    });

    it('should sort by name with numbers in order', () => {
      expect(names(dc, {method: SortByTypes.Name, ascending: true})).toEqual([['Árvíztűrő.jpg', 'Éclair 2.jpg', 'Éclair 10.jpg']]);
      expect(names(dc, {method: SortByTypes.Name, ascending: false})).toEqual([['Éclair 10.jpg', 'Éclair 2.jpg', 'Árvíztűrő.jpg']]);
    });

    it('should sort by rating', () => {
      expect(names(dc, {method: SortByTypes.Rating, ascending: true})).toEqual([['Éclair 2.jpg', 'Árvíztűrő.jpg', 'Éclair 10.jpg']]);
    });

    it('should group by day and sort inside the groups', () => {
      const groups = names(dc, {method: SortByTypes.Name, ascending: true}, {method: GroupByTypes.Date, ascending: true});
      expect(groups).toEqual([['Árvíztűrő.jpg', 'Éclair 2.jpg'], ['Éclair 10.jpg']]);
    });

    describe('every sorting and grouping option (#1308)', () => {
      const MB = 1024 * 1024;
      // name, date, rating, number of faces, file size; the order differs for every option
      // (the names have accents on purpose: the sorting must be accent aware)
      const all: DirectoryContent = {
        directories: [],
        metaFile: [],
        media: [
          detailedMedia('Zebra.jpg', Date.UTC(2025, 0, 3), 1, 3, 0.2 * MB),
          detailedMedia('Árvíztűrő.jpg', Date.UTC(2025, 0, 1), 3, 1, 12 * MB),
          detailedMedia('Avocado.jpg', Date.UTC(2025, 0, 2), 2, 2, 3 * MB),
          detailedMedia('éclair.jpg', Date.UTC(2025, 0, 4), 4, 0, 1.5 * MB),
        ]
      };
      const flat = (s: SortingMethod, g: GroupingMethod = noGrouping): string[] => names(all, s, g).flat();

      it('should sort by name accent aware: Árvíztűrő sorts with A, not after Z', () => {
        expect(flat({method: SortByTypes.Name, ascending: true})).toEqual(['Árvíztűrő.jpg', 'Avocado.jpg', 'éclair.jpg', 'Zebra.jpg']);
      });

      it('should sort by date', () => {
        expect(flat({method: SortByTypes.Date, ascending: true})).toEqual(['Árvíztűrő.jpg', 'Avocado.jpg', 'Zebra.jpg', 'éclair.jpg']);
        expect(flat({method: SortByTypes.Date, ascending: false})).toEqual(['éclair.jpg', 'Zebra.jpg', 'Avocado.jpg', 'Árvíztűrő.jpg']);
      });

      it('should sort by rating', () => {
        expect(flat({method: SortByTypes.Rating, ascending: false})).toEqual(['éclair.jpg', 'Árvíztűrő.jpg', 'Avocado.jpg', 'Zebra.jpg']);
      });

      it('should sort by the number of persons', () => {
        expect(flat({method: SortByTypes.PersonCount, ascending: true})).toEqual(['éclair.jpg', 'Árvíztűrő.jpg', 'Avocado.jpg', 'Zebra.jpg']);
      });

      it('should sort by file size', () => {
        expect(flat({method: SortByTypes.FileSize, ascending: true})).toEqual(['Zebra.jpg', 'éclair.jpg', 'Avocado.jpg', 'Árvíztűrő.jpg']);
      });

      it('should group by date', () => {
        const groups = service.applySorting({...all, media: [...all.media]}, {method: SortByTypes.Name, ascending: true},
          {method: GroupByTypes.Date, ascending: false})!.mediaGroups;
        expect(groups.map(g => g.media.map(m => m.name))).toEqual([['éclair.jpg'], ['Zebra.jpg'], ['Avocado.jpg'], ['Árvíztűrő.jpg']]);
        expect(groups.map(g => g.date)).toEqual([4, 3, 2, 1].map(d => new Date(Date.UTC(2025, 0, d))));
      });

      it('should group by rating', () => {
        const groups = service.applySorting({...all, media: [...all.media]}, {method: SortByTypes.Name, ascending: true},
          {method: GroupByTypes.Rating, ascending: true})!.mediaGroups;
        expect(groups.map(g => g.name)).toEqual(['1', '2', '3', '4']);
      });

      it('should group by the number of persons', () => {
        const groups = service.applySorting({...all, media: [...all.media]}, {method: SortByTypes.Name, ascending: true},
          {method: GroupByTypes.PersonCount, ascending: true})!.mediaGroups;
        expect(groups.map(g => g.name)).toEqual(['0', '1', '2', '3']);
      });

      it('should group by file size', () => {
        const groups = service.applySorting({...all, media: [...all.media]}, {method: SortByTypes.Name, ascending: true},
          {method: GroupByTypes.FileSize, ascending: true})!.mediaGroups;
        expect(groups.map(g => [g.name, g.media.map(m => m.name)])).toEqual([
          ['<0.5 MB', ['Zebra.jpg']],
          ['1 - 2 MB', ['éclair.jpg']],
          ['2 - 5 MB', ['Avocado.jpg']],
          ['10 - 15 MB', ['Árvíztűrő.jpg']],
        ]);
      });

      it('should not group at all with no grouping', () => {
        expect(names(all, {method: SortByTypes.Name, ascending: true})).toHaveLength(1);
      });

      // #1308: a letter with an accent does not split the A group: Árvíztűrő is in the same group as Avocado,
      // like it sorts with A
      it('should group by name accent aware: Árvíztűrő is in the A group', () => {
        const groups = service.applySorting({...all, media: [...all.media]}, {method: SortByTypes.Name, ascending: true},
          {method: GroupByTypes.Name, ascending: true})!.mediaGroups;
        expect(groups.map(g => g.media.map(m => m.name))).toEqual([['Árvíztűrő.jpg', 'Avocado.jpg'], ['éclair.jpg'], ['Zebra.jpg']]);
      });

      it('should sort the folders by name accent aware, also for the options that only apply to media', () => {
        const dirs = (s: SortingMethod): string[] => service.applySorting({
          ...all,
          directories: ['Zurich', 'Árvíztűrő', 'Aspen', 'Évian'].map(name => ({name} as SubDirectoryDTO))
        }, s, noGrouping)!.directories.map(d => d.name);
        for (const method of [SortByTypes.Name, SortByTypes.Rating, SortByTypes.PersonCount, SortByTypes.FileSize]) {
          expect(dirs({method, ascending: true}), SortByTypes[method]).toEqual(['Árvíztűrő', 'Aspen', 'Évian', 'Zurich']);
        }
        expect(dirs({method: SortByTypes.Name, ascending: false})).toEqual(['Zurich', 'Évian', 'Aspen', 'Árvíztűrő']);
      });
    });

    it('should shuffle the same way for the same content', () => {
      const random = {method: SortByTypes.Random, ascending: null} as SortingMethod;
      const first = names(dc, random);
      expect([...first[0]].sort()).toEqual(dc.media.map((m) => m.name).sort());
      expect(names(dc, random)).toEqual(first);
    });

    it('should not interleave media of same-named directories when sorting', () => {
      const root = {path: './', name: '.'};
      const summer2020 = {path: '2020/', name: 'Summer'};
      const summer2021 = {path: '2021/', name: 'Summer'};
      const dirMedia = (name: string, directory: { path: string; name: string }): MediaDTO =>
        ({name, directory, metadata: {size: {width: 10, height: 10}}} as unknown as MediaDTO);

      const res = service.applySorting({
        directories: [],
        metaFile: [],
        media: [
          dirMedia('1.jpg', summer2020),
          dirMedia('2.jpg', summer2021),
          dirMedia('r.jpg', root),
          dirMedia('3.jpg', summer2020),
          dirMedia('4.jpg', summer2021),
        ]
      }, {method: SortByTypes.Directory, ascending: true}, noGrouping);

      expect(res!.mediaGroups.length).toBe(1);
      expect(res!.mediaGroups[0].media.map((m) => m.name)).toEqual(['r.jpg', '1.jpg', '3.jpg', '2.jpg', '4.jpg']);
    });

    it('should group media by directory path, keeping same-named directories separate', () => {
      const root = {path: './', name: '.'};
      const summer2020 = {path: '2020/', name: 'Summer'};
      const summer2021 = {path: '2021/', name: 'Summer'};
      const dirMedia = (name: string, directory: { path: string; name: string }): MediaDTO =>
        ({name, directory, metadata: {size: {width: 10, height: 10}}} as unknown as MediaDTO);

      const res = service.applySorting({
        directories: [],
        metaFile: [],
        media: [
          dirMedia('1.jpg', summer2020),
          dirMedia('2.jpg', summer2021),
          dirMedia('r.jpg', root),
          dirMedia('3.jpg', summer2020),
          dirMedia('4.jpg', summer2021),
        ]
      }, {method: SortByTypes.Directory, ascending: true}, {method: GroupByTypes.Directory, ascending: true});

      expect(res!.mediaGroups.map((g) => g.name)).toEqual(['Home', '2020/Summer', '2021/Summer']);
      expect(res!.mediaGroups.map((g) => g.media.map((m) => m.name))).toEqual([['r.jpg'], ['1.jpg', '3.jpg'], ['2.jpg', '4.jpg']]);
    });
  });

  describe('getScrollLabelFn', () => {
    const photo = detailedMedia('Bravo.jpg', Date.UTC(2021, 5, 30, 23, 30), 4, 2, 3 * 1024 * 1024);
    const label = (s: SortingMethod, g: GroupingMethod) => service.getScrollLabelFn(s, g)?.label(photo);
    const sortBy = (method: SortingMethod['method']): SortingMethod => ({method, ascending: true});
    const groupBy = (method: GroupingMethod['method']): GroupingMethod => ({method, ascending: true});
    let mode: ScrollLabelModes;
    let ignoreOffset: boolean;

    beforeEach(() => {
      mode = Config.Gallery.NavBar.showScrollLabel;
      ignoreOffset = Config.Gallery.ignoreTimestampOffset;
      Config.Gallery.NavBar.showScrollLabel = ScrollLabelModes.always;
    });

    afterEach(() => {
      Config.Gallery.NavBar.showScrollLabel = mode;
      Config.Gallery.ignoreTimestampOffset = ignoreOffset;
    });

    it('should be the month and year for the date order', () => {
      expect(label(sortBy(SortByTypes.Date), groupBy(GroupByTypes.NoGrouping))).toBe('June 2021');
    });

    it('should be empty for a media without date', () => {
      const undated = {name: 'a.jpg', metadata: {size: {width: 10, height: 10}}} as unknown as MediaDTO;
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Date), groupBy(GroupByTypes.NoGrouping))?.label(undated)).toBe('');
    });

    it('should use the time zone handling of the date grouping', () => {
      const withOffset = {...photo, metadata: {...photo.metadata, creationDateOffset: '+02:00'}} as MediaDTO;
      Config.Gallery.ignoreTimestampOffset = true;
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Date), groupBy(GroupByTypes.NoGrouping))?.label(withOffset)).toBe('July 2021');
      Config.Gallery.ignoreTimestampOffset = false;
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Date), groupBy(GroupByTypes.NoGrouping))?.label(withOffset)).toBe('June 2021');
    });

    it('should reuse the group names of the other orders', () => {
      expect(label(sortBy(SortByTypes.Name), groupBy(GroupByTypes.NoGrouping))).toBe('B');
      expect(label(sortBy(SortByTypes.Rating), groupBy(GroupByTypes.NoGrouping))).toBe('4');
      expect(label(sortBy(SortByTypes.FileSize), groupBy(GroupByTypes.NoGrouping))).toBe('2 - 5 MB');
      expect(label(sortBy(SortByTypes.PersonCount), groupBy(GroupByTypes.NoGrouping))).toBe('2');
      const inFolder = {name: 'a.jpg', directory: {path: '2020/', name: 'Summer'}} as unknown as MediaDTO;
      const inRoot = {name: 'r.jpg', directory: {path: './', name: '.'}} as unknown as MediaDTO;
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Directory), groupBy(GroupByTypes.NoGrouping))?.label(inFolder)).toBe('2020/Summer');
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Directory), groupBy(GroupByTypes.NoGrouping))?.label(inRoot)).toBe('Home');
    });

    it('should not have a label for the random order', () => {
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Random), groupBy(GroupByTypes.NoGrouping))).toBeNull();
    });

    it('should follow the grouping and not the sorting', () => {
      // grouped by name, sorted by date: the dates jump back and forth with every group
      expect(label(sortBy(SortByTypes.Date), groupBy(GroupByTypes.Name))).toBe('B');
      // grouped by date, sorted by name: the dates are in order
      expect(label(sortBy(SortByTypes.Name), groupBy(GroupByTypes.Date))).toBe('June 2021');
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Name), groupBy(GroupByTypes.Date))?.order).toBe(SortByTypes.Date);
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Rating), groupBy(GroupByTypes.NoGrouping))?.order).toBe(SortByTypes.Rating);
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Date), groupBy(GroupByTypes.NoGrouping))).not.toBeNull();
    });

    it('should have no label in never mode', () => {
      Config.Gallery.NavBar.showScrollLabel = ScrollLabelModes.never;
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Date), groupBy(GroupByTypes.Date))).toBeNull();
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Name), groupBy(GroupByTypes.NoGrouping))).toBeNull();
    });

    it('should have a label only for the date order in date mode', () => {
      Config.Gallery.NavBar.showScrollLabel = ScrollLabelModes.date;
      expect(label(sortBy(SortByTypes.Name), groupBy(GroupByTypes.Date))).toBe('June 2021');
      expect(label(sortBy(SortByTypes.Date), groupBy(GroupByTypes.NoGrouping))).toBe('June 2021');
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Date), groupBy(GroupByTypes.Name))).toBeNull();
      expect(service.getScrollLabelFn(sortBy(SortByTypes.Name), groupBy(GroupByTypes.NoGrouping))).toBeNull();
    });
  });
});
