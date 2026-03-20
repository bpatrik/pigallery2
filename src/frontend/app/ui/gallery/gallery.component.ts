import {Component, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';
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
import {GPXFilesFilterPipe} from '../../pipes/GPXFilesFilterPipe';
import {MDFilesFilterPipe} from '../../pipes/MDFilesFilterPipe';
import {ContentLoaderService} from './contentLoader.service';
import {GalleryLightboxComponent} from './lightbox/lightbox.gallery.component';
import {FrameComponent} from '../frame/frame.component';
import {NgIf} from '@angular/common';
import {RandomQueryBuilderGalleryComponent} from './random-query-builder/random-query-builder.gallery.component';
import {PhotoFrameBuilderGalleryComponent} from './photo-frame-builder/photo-frame-builder.gallery.component';
import {GalleryNavigatorComponent} from './navigator/navigator.gallery.component';
import {DirectoriesComponent} from './directories/directories.component';
import {GalleryBlogComponent} from './blog/blog.gallery.component';
import {GalleryMapComponent} from './map/map.gallery.component';
import {PhotoFilterPipe} from '../../pipes/PhotoFilterPipe';
import {MediaButtonModalComponent} from './grid/photo/media-button-modal/media-button-modal.component';
import {ContentWrapperWithError} from '../../../../common/entities/ContentWrapper';
import {SearchQueryUtils} from '../../../../common/SearchQueryUtils';
import {UploaderService} from './uploader/uploader.service';
import {GalleryService} from './gallery.service';
import {UploaderComponent} from './uploader/uploader.gallery.component';

@Component({
  selector: 'app-gallery',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css'],
  imports: [
    GalleryLightboxComponent,
    FrameComponent,
    NgIf,
    RandomQueryBuilderGalleryComponent,
    PhotoFrameBuilderGalleryComponent,
    GalleryNavigatorComponent,
    DirectoriesComponent,
    GalleryBlogComponent,
    GalleryMapComponent,
    GalleryGridComponent,
    GPXFilesFilterPipe,
    PhotoFilterPipe,
    MediaButtonModalComponent,
    UploaderComponent
  ]
})
export class GalleryComponent implements OnInit, OnDestroy {
  @ViewChild(GalleryGridComponent, {static: false})
  grid: GalleryGridComponent;

  public showSearchBar = false;
  public showShare = false;
  public showRandomPhotoBuilder = false;
  public blogOpen = Config.Gallery.TopBlogStartsOpen;

  config = Config;
  public isPhotoWithLocation = false;
  public countDown: {
    day: number;
    hour: number;
    minute: number;
    second: number;
  } = null;
  public readonly mapEnabled: boolean;
  public directoryContent: GroupedDirectoryContent;
  public isUploadOver = false;
  private $counter: Observable<number>;
  private subscription: { [key: string]: Subscription } = {
    content: null,
    route: null,
    timer: null,
    sorting: null,
  };

  constructor(
    public contentLoader: ContentLoaderService,
    public contentService: ContentService,
    public galleryService: GalleryService,
    private authService: AuthenticationService,
    private router: Router,
    private shareService: ShareService,
    private route: ActivatedRoute,
    private navigation: NavigationService,
    private filterService: FilterService,
    private sortingService: GallerySortingService,
    private piTitleService: PiTitleService,
    private gpxFilesFilterPipe: GPXFilesFilterPipe,
    private mdFilesFilterPipe: MDFilesFilterPipe,
    public uploaderService: UploaderService,
  ) {
    this.mapEnabled = Config.Map.enabled;
    PageHelper.showScrollY('gallery');
  }

  get ContentWrapper(): ContentWrapperWithError {
    return this.contentLoader.content.value;
  }

  get ShowMarkDown(): boolean {
    return this.config.MetaFile.markdown && this.directoryContent?.metaFile && this.mdFilesFilterPipe.transform(this.directoryContent.metaFile).length > 0;
  }

  get ShowMap(): boolean {
    return (this.isPhotoWithLocation || this.gpxFilesFilterPipe.transform(this.directoryContent?.metaFile)?.length > 0) && this.mapEnabled;
  }

  updateTimer(t: number): void {
    if (this.shareService.sharingSubject.value == null) {
      return;
    }
    // if the timer is longer than 10 years, just do not show it
    if (
      (this.shareService.sharingSubject.value.expires - Date.now()) /
      1000 /
      86400 /
      365 >
      10
    ) {
      return;
    }

    t = Math.floor(
      (this.shareService.sharingSubject.value.expires - Date.now()) / 1000
    );
    this.countDown = {} as any;
    this.countDown.day = Math.floor(t / 86400);
    t -= this.countDown.day * 86400;
    this.countDown.hour = Math.floor(t / 3600) % 24;
    t -= this.countDown.hour * 3600;
    this.countDown.minute = Math.floor(t / 60) % 60;
    t -= this.countDown.minute * 60;
    this.countDown.second = t % 60;
  }

  ngOnDestroy(): void {
    if (this.subscription.content !== null) {
      this.subscription.content.unsubscribe();
    }
    if (this.subscription.route !== null) {
      this.subscription.route.unsubscribe();
    }
    if (this.subscription.timer !== null) {
      this.subscription.timer.unsubscribe();
    }
    if (this.subscription.sorting !== null) {
      this.subscription.sorting.unsubscribe();
    }
  }

  async ngOnInit(): Promise<boolean> {
    await this.shareService.wait();
    if (!this.authService.isAuthenticated()) {
      return this.navigation.toLogin();
    }
    this.showSearchBar = this.authService.canSearch();
    this.showShare =
      Config.Sharing.enabled &&
      this.authService.isAuthorized(UserRoles.User);
    this.showRandomPhotoBuilder =
      Config.RandomPhoto.enabled &&
      this.authService.isAuthorized(UserRoles.User);
    this.subscription.content = this.contentService.sortedFilteredContent
      .subscribe((dc: GroupedDirectoryContent) => {
        this.onContentChange(dc);
      });
    this.subscription.route = this.route.params.subscribe(this.onRoute);

    if (this.shareService.isSharing()) {
      this.$counter = interval(1000);
      this.subscription.timer = this.$counter.subscribe((x): void =>
        this.updateTimer(x)
      );
    }
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (this.uploaderService.canUpload()) {
      event.preventDefault();
      event.stopPropagation();
      this.isUploadOver = true;
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    if (this.uploaderService.canUpload()) {
      event.preventDefault();
      event.stopPropagation();
      this.isUploadOver = false;
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (this.uploaderService.canUpload()) {
      event.preventDefault();
      event.stopPropagation();
      this.isUploadOver = false;
      const files = event.dataTransfer.files;
      if (files.length > 0) {
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
      const qParams: { [key: string]: any } = {};
      qParams[QueryParams.gallery.sharingKey_query] =
        this.shareService.getSharingKey();
      this.router
        .navigate(['/search', JSON.stringify(sharing.searchQuery)], {queryParams: qParams})
        .catch(console.error);
      return;
    }

    let directoryName = params[QueryParams.gallery.directory];
    directoryName = directoryName || '';

    this.piTitleService.setDirectoryTitle(directoryName);
    this.contentLoader.loadDirectory(directoryName);
  };

  private onContentChange = (content: GroupedDirectoryContent): void => {
    if (!content) {
      return;
    }
    this.directoryContent = content;

    // enforce change detection on grid
    this.directoryContent.mediaGroups = this.directoryContent.mediaGroups?.slice();
    this.isPhotoWithLocation = false;

    for (const mediaGroup of content.mediaGroups) {

      if (
        mediaGroup.media
          .findIndex((m: PhotoDTO) => !!m.metadata?.positionData?.GPSData?.longitude) !== -1
      ) {
        this.isPhotoWithLocation = true;
        break;
      }
    }
  };

}
