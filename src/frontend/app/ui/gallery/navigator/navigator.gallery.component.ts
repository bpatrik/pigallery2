import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {UserRoles} from '../../../../../common/entities/UserDTO';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {QueryService} from '../../../model/query.service';
import {Utils} from '../../../../../common/Utils';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';
import {GroupByTypes, GroupingMethod, SortByDirectionalTypes, SortByTypes} from '../../../../../common/entities/SortingMethods';
import {Config} from '../../../../../common/config/public/Config';
import {SearchQueryDTO, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../common/entities/SearchQueryDTO';
import {GallerySortingService} from './sorting.service';
import {PageHelper} from '../../../model/page.helper';
import {BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective} from 'ngx-bootstrap/dropdown';
import {FilterService} from '../filter/filter.service';
import {ContentLoaderService} from '../contentLoader.service';
import {GalleryNavigatorService} from './navigator.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {NgIconComponent} from '@ng-icons/core';
import {SortingMethodIconComponent} from '../../utils/sorting-method-icon/sorting-method-icon.component';
import {GridSizeIconComponent} from '../../utils/grid-size-icon/grid-size-icon.component';
import {GalleryFilterComponent} from '../filter/filter.gallery.component';
import {StringifySortingMethod} from '../../../pipes/StringifySortingMethod';
import {StringifySearchQuery} from '../../../pipes/StringifySearchQuery';
import {StringifyGridSize} from '../../../pipes/StringifyGridSize';
import {ContentWrapperWithError} from '../../../../../common/entities/ContentWrapper';

@Component({
  selector: 'app-gallery-navbar',
  host: {
    '(window:keydown)': 'onKeyPress($event)',
    '(window:scroll)': 'onScroll()',
    '(window:resize)': 'updateFilterMaxHeight()'
  },
  styleUrl: './navigator.gallery.component.css',
  templateUrl: './navigator.gallery.component.html',
  imports: [
    RouterLink,
    NgIconComponent,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    SortingMethodIconComponent,
    BsDropdownMenuDirective,
    GridSizeIconComponent,
    GalleryFilterComponent,
    StringifySortingMethod,
    StringifySearchQuery,
    StringifyGridSize
]
})
export class GalleryNavigatorComponent {
  authService = inject(AuthenticationService);
  queryService = inject(QueryService);
  contentLoaderService = inject(ContentLoaderService);
  filterService = inject(FilterService);
  sortingService = inject(GallerySortingService);
  navigatorService = inject(GalleryNavigatorService);
  private router = inject(Router);

  public readonly sortingByTypes: { key: number; value: string }[] = [];
  public readonly groupingByTypes: { key: number; value: string }[] = [];
  public readonly gridSizes: { key: number; value: string }[] = [];
  public readonly config = Config;
  // DefaultSorting = Config.Gallery.defaultPhotoSortingMethod;
  public readonly SearchQueryTypes = SearchQueryTypes;
  public showFilters = false;
  // the filters fill the screen below the navigator; measured when they open and on scroll or resize
  public readonly filterMaxHeight = signal<string | null>(null);
  readonly dropdown = viewChild<BsDropdownDirective>('dropdown');
  readonly navigatorElement = viewChild('navigator', { read: ElementRef });
  public groupingFollowSorting = true; // if grouping should be set after sorting automatically
  protected readonly GroupByTypes = GroupByTypes;
  private readonly RootFolderName: string;
  private lastScroll = {
    any: 0,
    up: 0,
    down: 0
  };

  public readonly routes = computed((): NavigatorPath[] => {
    const c = this.contentLoaderService.content();
    if (!c?.directory && !this.isExactDirectorySearch(c)) {
      return [];
    }

    let path: string;
    let name: string;
    if (c?.directory) {
      path = c.directory.path;
      name = c.directory.name;
    } else {
      // Handle exact directory search
      const searchQuery = c?.searchResult?.searchQuery as TextSearch;
      path = searchQuery.value.replace(/^\.\//, ''); // Remove leading ./ if present
      const lastSlashIndex = path.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        name = path.substring(lastSlashIndex + 1);
        path = path.substring(0, lastSlashIndex);
      } else {
        name = path;
        path = '';
      }
    }

    path = path.replace(new RegExp('\\\\', 'g'), '/');
    const dirs = path.split('/');
    dirs.push(name);

    // removing empty strings
    for (let i = 0; i < dirs.length; i++) {
      if (!dirs[i] || 0 === dirs[i].length || '.' === dirs[i]) {
        dirs.splice(i, 1);
        i--;
      }
    }

    const user = this.authService.user();
    const arr: NavigatorPath[] = [];
    // the server tells which parents are available, starting from the root
    const availableParents = c?.directory?.availableParents;
    const isParentAvailable = (index: number): boolean => {
      if (Array.isArray(availableParents)) {
        return availableParents[index] === true;
      }
      // without a user (e.g. while logging out) no parent is available
      return !!user && user.role > UserRoles.LimitedGuest; // it's basically a sharing. they should not just navigate wherever
    };

    // create root link
    if (dirs.length === 0) {
      arr.push({name: this.RootFolderName, route: null});
    } else {
      arr.push({
        name: this.RootFolderName,
        route: isParentAvailable(0) ? '/' : null,
      });
    }

    // create rest navigation
    dirs.forEach((name, index) => {
      const route = dirs.slice(0, index + 1).join('/');
      if (dirs.length - 1 === index) {
        arr.push({name, route: null});
      } else {
        arr.push({
          name,
          // root is the 0th parent
          route: isParentAvailable(index + 1) ? route : null,
        });

      }
    });

    // parent directory has a shortcut to navigate to
    if (arr.length >= 2 && arr[arr.length - 2].route) {
      arr[arr.length - 2].title = $localize`key: alt + up`;
    }
    return arr;
  });

  private readonly parentPath = computed((): string | null => {
    const arr = this.routes();
    return arr.length >= 2 ? arr[arr.length - 2].route : null;
  });

  constructor() {
    this.sortingByTypes = Utils.enumToArray(SortByTypes);
    // can't group by random
    this.groupingByTypes = Utils.enumToArray(GroupByTypes);
    this.gridSizes = Utils.enumToArray(GridSizes);
    this.RootFolderName = $localize`Home`;
  }

  public readonly isDirectory = computed((): boolean => {
    const content = this.contentLoaderService.content();
    return !!content?.directory || this.isExactDirectorySearch(content);
  });

  public readonly isSearch = computed((): boolean => {
    const content = this.contentLoaderService.content();
    return !!content?.searchResult && !this.isExactDirectorySearch(content);
  });

  public readonly itemCount = computed((): number => {
    const c = this.contentLoaderService.content();
    return (c?.directory
      ? c.directory.cache?.mediaCount
      : c?.searchResult
        ? c.searchResult.media?.length
        : 0) ?? 0;
  });

  public readonly isDefaultSortingAndGrouping = computed((): boolean =>
    this.sortingService.isDefaultSortingAndGrouping(
      this.contentLoaderService.content()
    ));

  public readonly isDirectionalSorting = computed((): boolean => this.isDirectionalSort(this.sortingService.sorting().method));
  public readonly isDirectionalGrouping = computed((): boolean => this.isDirectionalSort(this.sortingService.grouping().method));


  isDirectionalSort(value: number) {
    return Utils.isValidEnumInt(SortByDirectionalTypes, value);
  }

  setSortingBy(sorting: number): void {
    const s = {method: sorting, ascending: this.sortingService.sorting().ascending};
    // random does not have a direction
    if (!this.isDirectionalSort(sorting)) {
      s.ascending = null;
    } else if (s.ascending === null) {
      s.ascending = true;
    }
    this.sortingService.setSorting(s);
    // you cannot group by random
    if (!this.isDirectionalSort(sorting) ||
      // if grouping is disabled, do not update it
      this.sortingService.grouping().method === GroupByTypes.NoGrouping || !this.groupingFollowSorting
    ) {
      return;
    }

    this.sortingService.setGrouping({method: s.method, ascending: s.ascending ?? true}); // directional, so it has a direction
  }

  setSortingAscending(asc: boolean) {
    const s = {method: this.sortingService.sorting().method, ascending: asc};
    this.sortingService.setSorting(s);

    // if grouping is disabled, do not update it
    if (this.sortingService.grouping().method == GroupByTypes.NoGrouping || !this.groupingFollowSorting) {
      return;
    }
    this.sortingService.setGrouping(s as GroupingMethod);
  }

  setGroupingBy(grouping: number): void {
    const s = {method: grouping, ascending: this.sortingService.grouping().ascending};
    this.sortingService.setGrouping(s);
  }

  setGroupingAscending(asc: boolean) {
    const s = {method: this.sortingService.grouping().method, ascending: asc};
    this.sortingService.setGrouping(s);
  }


  public readonly downloadZipLink = computed((): string | null => {
    const c = this.contentLoaderService.content();
    if (!c) {
      return null;
    }

    let searchQuery: SearchQueryDTO;
    if (c.searchResult) {
      // For search results, use the existing search query
      searchQuery = c.searchResult.searchQuery;
    } else if (c.directory) {
      // For directory content, create an exact directory search query
      searchQuery = {
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value: Utils.concatUrls('./', c?.directory.path, c?.directory.name)
      } as TextSearch;
    } else {
      return null;
    }

    let queryParams = '';
    Object.entries(this.queryService.params()).forEach((e) => {
      queryParams += e[0] + '=' + e[1];
    });

    return Config.Server.getApiUrl(
      '/gallery/zip/',
      encodeURIComponent(JSON.stringify(searchQuery)) +
      '?' + queryParams
    );
  });

  public readonly directoryFlattenSearchQuery = computed((): string | null => {
    const c = this.contentLoaderService.content();
    if (!c.directory) {
      return null;
    }
    return SearchQueryUtils.urlify({
      type: SearchQueryTypes.directory,
      matchType: TextSearchQueryMatchTypes.globMatch,
      value: Utils.concatUrls('./', c?.directory.path, c?.directory.name) + '*',
    } as TextSearch);
  });


  navigateToParentDirectory() {
    if (!this.parentPath()) {
      return;
    }
    this.router.navigate(['/gallery', this.parentPath()],
      {queryParams: this.queryService.getParams()})
      .catch(console.error);
  }

  onKeyPress(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
        if (event.altKey) {
          this.navigateToParentDirectory();
        }
        break;
    }
  }


  onScroll(): void {
    const scrollPosition = PageHelper.ScrollY;
    if (this.lastScroll.any < scrollPosition) { // scroll down
      //hide delay
      if (this.lastScroll.up < scrollPosition - window.innerHeight * Config.Gallery.NavBar.NavbarHideDelay) {
        this.showFilters = false;
        this.dropdown()?.hide();
      }
      this.lastScroll.down = scrollPosition;
    } else if (this.lastScroll.any > scrollPosition) {
      this.lastScroll.up = scrollPosition;
    }
    this.lastScroll.any = scrollPosition;
    this.updateFilterMaxHeight();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    this.updateFilterMaxHeight();
  }

  updateFilterMaxHeight(): void {
    if (!this.showFilters) {
      return;
    }
    const rect = this.navigatorElement()?.nativeElement?.getBoundingClientRect();
    this.filterMaxHeight.set('calc(100dvh - ' + (rect?.top + rect?.height) + 'px)');
  }

  private isExactDirectorySearch(content: ContentWrapperWithError): boolean {
    const searchQuery = content?.searchResult?.searchQuery as TextSearch;
    return !!content?.searchResult &&
      searchQuery?.type === SearchQueryTypes.directory &&
      searchQuery?.matchType === TextSearchQueryMatchTypes.exact_match &&
      !searchQuery?.negate;
  }
}

interface NavigatorPath {
  name: string;
  route: string | null;
  title?: string;
}
