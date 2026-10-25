import {DatePipe} from '@angular/common';
import {BehaviorSubject, of} from 'rxjs';
import {take} from 'rxjs/operators';
import {GallerySortingService, GroupedDirectoryContent} from './sorting.service';
import {DirectoryContent} from '../contentLoader.service';
import {GroupByBasicTypes, GroupByTypes, SortByTypes} from '../../../../../common/entities/SortingMethods';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';

describe('GallerySortingService directory sorting and grouping', () => {
  const root = {path: './', name: '.'};
  const summer2020 = {path: '2020/', name: 'Summer'};
  const summer2021 = {path: '2021/', name: 'Summer'};

  const media = (name: string, directory: { path: string; name: string }): MediaDTO =>
    ({name, directory} as MediaDTO);

  let service: GallerySortingService;

  beforeEach(() => {
    service = new GallerySortingService(
      {getSorting: (): null => null, getGrouping: (): null => null} as never,
      {content: new BehaviorSubject(null)} as never,
      {setSeed: (): void => undefined, get: (): number => 0} as never,
      new DatePipe('en-US')
    );
  });

  const applyDirectorySorting = (items: MediaDTO[], grouping: number): GroupedDirectoryContent => {
    service.sorting.next({method: SortByTypes.Directory, ascending: true});
    service.grouping.next({method: grouping, ascending: true});
    let result: GroupedDirectoryContent;
    service.applySorting(of({directories: [], media: items, metaFile: []} as DirectoryContent))
      .pipe(take(1))
      .subscribe((r) => result = r);
    return result;
  };

  const mediaNames = (group: { media: MediaDTO[] }): string[] => group.media.map((m) => m.name);

  it('should not interleave media of same-named directories when sorting', () => {
    const result = applyDirectorySorting([
      media('1.jpg', summer2020),
      media('2.jpg', summer2021),
      media('r.jpg', root),
      media('3.jpg', summer2020),
      media('4.jpg', summer2021),
    ], GroupByBasicTypes.NoGrouping);

    expect(result.mediaGroups.length).toBe(1);
    expect(mediaNames(result.mediaGroups[0])).toEqual(['r.jpg', '1.jpg', '3.jpg', '2.jpg', '4.jpg']);
  });

  it('should group same-named directories separately by their full path and label the root as Home', () => {
    const result = applyDirectorySorting([
      media('1.jpg', summer2020),
      media('2.jpg', summer2021),
      media('r.jpg', root),
      media('3.jpg', summer2020),
      media('4.jpg', summer2021),
    ], GroupByTypes.Directory);

    expect(result.mediaGroups.map((g) => g.name)).toEqual(['Home', '2020/Summer', '2021/Summer']);
    expect(result.mediaGroups.map(mediaNames)).toEqual([['r.jpg'], ['1.jpg', '3.jpg'], ['2.jpg', '4.jpg']]);
  });
});
