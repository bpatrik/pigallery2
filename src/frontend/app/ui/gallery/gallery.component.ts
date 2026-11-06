import { Component, OnDestroy, OnInit, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import {AuthenticationService} from '../../model/network/authentication.service';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {ContentService} from './content.service';
import {GalleryGridComponent} from './grid/grid.gallery.component';
import {Config} from '../../../../common/config/public/Config';
import {ShareService} from './share.service';
import {NavigationService} from '../../model/navigation.service';
import {UserRoles} from '../../../../common/entities/UserDTO';
import {interval, Observable, Subscription} from 'rxjs';
import {PageHelper} from '../../model/page.helper';
import {PhotoDTO} from '../../../../common/entities/PhotoDTO';
import {QueryParams} from '../../../../common/QueryParams';
import {take} from 'rxjs/operators';
import {GallerySortingService, GroupedDirectoryContent} from './navigator/sorting.service';
import {FilterService} from './filter/filter.service';
import {PiTitleService} from '../../model/pi-title.service';
import {filterGPXFiles, GPXFilesFilterPipe} from '../../pipes/GPXFilesFilterPipe';
import {filterMDFiles} from '../../pipes/MDFilesFilterPipe';
import {ContentLoaderService} from './contentLoader.service';
import {GalleryLightboxComponent} from './lightbox/lightbox.gallery.component';
import {FrameComponent} from '../frame/frame.component';

import {RandomQueryBuilderGalleryComponent} from './random-query-builder/random-query-builder.gallery.component';
import {PhotoFrameBuilderGalleryComponent} from './photo-frame-builder/photo-frame-builder.gallery.component';
import {GalleryNavigatorComponent} from './navigator/navigator.gallery.component';
import {DirectoriesComponent} from './directories/directories.component';
import {GalleryBlogComponent} from './blog/blog.gallery.component';
import {GalleryMapComponent} from './map/map.gallery.component';
import {ReloadAfterUpgradeComponent} from '../../model/lazy-loading';
import {PhotoFilterPipe} from '../../pipes/PhotoFilterPipe';
import {MediaButtonModalComponent} from './grid/photo/media-button-modal/media-button-modal.component';
import {ContentWrapperWithError} from '../../../../common/entities/ContentWrapper';
import {SearchQueryUtils} from '../../../../common/SearchQueryUtils';
import {UploaderService} from './uploader/uploader.service';
import {GalleryService} from './gallery.service';
import {UploaderComponent} from './uploader/uploader.gallery.component';

@Component({
  selector: 'app-gallery',
  host: {
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)'
  },
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css',
  imports: [
    GalleryLightboxComponent,
    FrameComponent,
    RandomQueryBuilderGalleryComponent,
    PhotoFrameBuilderGalleryComponent,
    GalleryNavigatorComponent,
    DirectoriesComponent,
    GalleryBlogComponent,
    GalleryMapComponent,
    ReloadAfterUpgradeComponent,
    GalleryGridComponent,
    GPXFilesFilterPipe,
    PhotoFilterPipe,
    MediaButtonModalComponent,
    UploaderComponent
]
})
export class GalleryComponent implements OnInit, OnDestroy {
  contentLoader = inject(ContentLoaderService);
  contentService = inject(ContentService);
  galleryService = inject(GalleryService);
  private authService = inject(AuthenticationService);
  private router = inject(Router);
  private shareService = inject(ShareService);
  private route = inject(ActivatedRoute);
  private navigation = inject(NavigationService);
  private filterService = inject(FilterService);
  private sortingService = inject(GallerySortingService);
  private piTitleService = inject(PiTitleService);
  uploaderService = inject(UploaderService);

  readonly grid = viewChild(GalleryGridComponent);

  public readonly showSearchBar = signal(false);
  public readonly showShare = signal(false);
  public readonly showRandomPhotoBuilder = signal(false);
  public blogOpen = Config.Gallery.TopBlogStartsOpen;

  config = Config;
  // the remaining time of the sharing; hours, minutes and seconds are two digits
  public readonly countDown = signal<{
    day: number;
    hour: string;
    minute: string;
    second: string;
  } | null>(null);
  public readonly mapEnabled: boolean;
  // keeps showing the previous content while the next one loads
  public readonly directoryContent = linkedSignal<GroupedDirectoryContent | null, GroupedDirectoryContent | null | undefined>({
    source: this.contentService.sortedFilteredContent,
    computation: (content, previous) => content ?? previous?.value
  });
  public readonly isPhotoWithLocation = computed((): boolean =>
    !!this.directoryContent()?.mediaGroups.some((mediaGroup) =>
      mediaGroup.media.some((m: PhotoDTO) => !!m.metadata?.positionData?.GPSData?.longitude)
    )
  );
  public isUploadOver = false;
  private $counter: Observable<number>;
  private subscription: { route: Subscription | null, timer: Subscription | null } = {
    route: null,
    timer: null,
  };

  constructor() {
    this.mapEnabled = Config.Map.enabled;
    PageHelper.showScrollY('gallery');
  }

  get ContentWrapper(): ContentWrapperWithError {
    return this.contentLoader.content();
  }

  get ShowMarkDown(): boolean {
    const metaFile = this.directoryContent()?.metaFile;
    return this.config.MetaFile.markdown && !!metaFile && (filterMDFiles(metaFile)?.length ?? 0) > 0;
  }

  get ShowMap(): boolean {
    return (this.isPhotoWithLocation() || filterGPXFiles(this.directoryContent()?.metaFile).length > 0) && this.mapEnabled;
  }

  updateTimer(t: number): void {
    const sharing = this.shareService.sharing();
    if (sharing == null) {
      return;
    }
    // if the timer is longer than 10 years, just do not show it
    if (
      (sharing.expires - Date.now()) /
      1000 /
      86400 /
      365 >
      10
    ) {
      return;
    }

    t = Math.floor(
      (sharing.expires - Date.now()) / 1000
    );
    const day = Math.floor(t / 86400);
    t -= day * 86400;
    const hour = Math.floor(t / 3600) % 24;
    t -= hour * 3600;
    const minute = Math.floor(t / 60) % 60;
    t -= minute * 60;
    const second = t % 60;
    const twoDigits = (n: number): string => ('0' + n).slice(-2);
    this.countDown.set({day, hour: twoDigits(hour), minute: twoDigits(minute), second: twoDigits(second)});
  }

  ngOnDestroy(): void {
    if (this.subscription.route !== null) {
      this.subscription.route.unsubscribe();
    }
    if (this.subscription.timer !== null) {
      this.subscription.timer.unsubscribe();
    }
  }

  async ngOnInit(): Promise<boolean | undefined> {
    await this.shareService.wait();
    if (!this.authService.isAuthenticated()) {
      return this.navigation.toLogin();
    }
    this.showSearchBar.set(this.authService.canSearch());
    this.showShare.set(
      Config.Sharing.enabled &&
      this.authService.isAuthorized(UserRoles.User));
    this.showRandomPhotoBuilder.set(
      Config.RandomPhoto.enabled &&
      this.authService.isAuthorized(UserRoles.User));
    this.subscription.route = this.route.params.subscribe(this.onRoute);

    if (this.shareService.isSharing()) {
      this.$counter = interval(1000);
      this.subscription.timer = this.$counter.subscribe((x): void =>
        this.updateTimer(x)
      );
    }
    return undefined;
  }

  onDragOver(event: DragEvent): void {
    if (this.uploaderService.canUpload()) {
      event.preventDefault();
      event.stopPropagation();
      this.isUploadOver = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    if (this.uploaderService.canUpload()) {
      event.preventDefault();
      event.stopPropagation();
      this.isUploadOver = false;
    }
  }

  onDrop(event: DragEvent): void {
    if (this.uploaderService.canUpload()) {
      event.preventDefault();
      event.stopPropagation();
      this.isUploadOver = false;
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        this.uploaderService.uploadFiles(files);
      }
    }
  }

  private onRoute = async (params: Params): Promise<void> => {
    const searchQuery = SearchQueryUtils.parseURLifiedQuery(params[QueryParams.gallery.search.query]);
    if (searchQuery) {
      this.contentLoader.search(searchQuery).catch(console.error);
      this.piTitleService.setSearchTitle(searchQuery);
      return;
    }

    if (
      params[QueryParams.gallery.sharingKey_params] &&
      params[QueryParams.gallery.sharingKey_params] !== ''
    ) {
      const sharing = await this.shareService.currentSharing
        .pipe(take(1))
        .toPromise();
      const qParams: Record<string, string | null> = {};
      qParams[QueryParams.gallery.sharingKey_query] =
        this.shareService.getSharingKey();
      const route = this.shareService.getDefaultRoute(sharing);
      if (!route) {
        console.error('Sharing has nothing to open');
        return;
      }
      this.router
        .navigate(route, {queryParams: qParams})
        .catch(console.error);
      return;
    }

    let directoryName = params[QueryParams.gallery.directory];
    directoryName = directoryName || '';

    this.piTitleService.setDirectoryTitle(directoryName);
    this.contentLoader.loadDirectory(directoryName);
  };

}
