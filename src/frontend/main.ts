import {enableProdMode, importProvidersFrom, Injectable} from '@angular/core';
import {environment} from './environments/environment';
import {HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {ErrorInterceptor} from './app/model/network/helper/error.interceptor';
import {DefaultUrlSerializer, UrlSerializer, UrlTree} from '@angular/router';
import {bootstrapApplication, BrowserModule, HAMMER_GESTURE_CONFIG, HammerGestureConfig, HammerModule} from '@angular/platform-browser';
import {StringifySortingMethod} from './app/pipes/StringifySortingMethod';
import {NetworkService} from './app/model/network/network.service';
import {ShareService} from './app/ui/gallery/share.service';
import {UserService} from './app/model/network/user.service';
import {AlbumsService} from './app/ui/albums/albums.service';
import {GalleryCacheService} from './app/ui/gallery/cache.gallery.service';
import {ContentService} from './app/ui/gallery/content.service';
import {ContentLoaderService} from './app/ui/gallery/contentLoader.service';
import {FilterService} from './app/ui/gallery/filter/filter.service';
import {GallerySortingService} from './app/ui/gallery/navigator/sorting.service';
import {GalleryNavigatorService} from './app/ui/gallery/navigator/navigator.service';
import {MapService} from './app/ui/gallery/map/map.service';
import {BlogService} from './app/ui/gallery/blog/blog.service';
import {SearchQueryParserService} from './app/ui/gallery/search/search-query-parser.service';
import {AutoCompleteService} from './app/ui/gallery/search/autocomplete.service';
import {AuthenticationService} from './app/model/network/authentication.service';
import {ThumbnailLoaderService} from './app/ui/gallery/thumbnailLoader.service';
import {ThumbnailManagerService} from './app/ui/gallery/thumbnailManager.service';
import {NotificationService} from './app/model/notification.service';
import {FullScreenService} from './app/ui/gallery/fullscreen.service';
import {NavigationService} from './app/model/navigation.service';
import {SettingsService} from './app/ui/settings/settings.service';
import {SeededRandomService} from './app/model/seededRandom.service';
import {OverlayService} from './app/ui/gallery/overlay.service';
import {QueryService} from './app/model/query.service';
import {ThemeService} from './app/model/theme.service';
import {DuplicateService} from './app/ui/duplicates/duplicates.service';
import {FacesService} from './app/ui/faces/faces.service';
import {VersionService} from './app/model/version.service';
import {ScheduledJobsService} from './app/ui/settings/scheduled-jobs.service';
import {BackendtextService} from './app/model/backendtext.service';
import {CookieService} from 'ngx-cookie-service';
import {GPXFilesFilterPipe} from './app/pipes/GPXFilesFilterPipe';
import {MDFilesFilterPipe} from './app/pipes/MDFilesFilterPipe';
import {FileSizePipe} from './app/pipes/FileSizePipe';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {provideAnimations} from '@angular/platform-browser/animations';
import {AppRoutingModule} from './app/app.routing';
import {NgIconsModule} from '@ng-icons/core';
import {
  ionAddOutline,
  ionAlbumsOutline,
  ionAppsOutline,
  ionArrowDownOutline,
  ionArrowUpOutline,
  ionBrowsersOutline,
  ionBrushOutline,
  ionCalendarOutline,
  ionCameraOutline,
  ionCaretDown,
  ionCaretForward,
  ionChatboxOutline,
  ionCheckmarkOutline,
  ionChevronBackOutline,
  ionChevronDownOutline,
  ionChevronForwardOutline,
  ionChevronUpOutline,
  ionCloseOutline,
  ionCloudOutline,
  ionCloudUploadOutline,
  ionContractOutline,
  ionCopyOutline,
  ionDocumentOutline,
  ionDocumentTextOutline,
  ionDownloadOutline,
  ionExpandOutline,
  ionExtensionPuzzleOutline,
  ionFileTrayFullOutline,
  ionFingerPrint,
  ionFlagOutline,
  ionFolderOutline,
  ionFunnelOutline,
  ionGitBranchOutline,
  ionGlobeOutline,
  ionGridOutline,
  ionHammerOutline,
  ionImageOutline,
  ionImagesOutline,
  ionInformationCircleOutline,
  ionInformationOutline,
  ionLinkOutline,
  ionList,
  ionLocationOutline,
  ionLockClosedOutline,
  ionLogOutOutline,
  ionMenuOutline,
  ionMoonOutline,
  ionOpenOutline,
  ionPauseOutline,
  ionPencil,
  ionPeopleOutline,
  ionPersonOutline,
  ionPieChartOutline,
  ionPlayOutline,
  ionPricetagOutline,
  ionPulseOutline,
  ionRefresh,
  ionReload,
  ionRemoveOutline,
  ionResizeOutline,
  ionSaveOutline,
  ionSearchOutline,
  ionServerOutline,
  ionSettingsOutline,
  ionShareSocialOutline,
  ionShuffleOutline,
  ionSquareOutline,
  ionStar,
  ionStarOutline,
  ionStopOutline,
  ionSunnyOutline,
  ionTextOutline,
  ionTimeOutline,
  ionTimerOutline,
  ionTrashOutline,
  ionUnlinkOutline,
  ionVideocamOutline,
  ionVolumeMediumOutline,
  ionVolumeMuteOutline,
  ionWarningOutline
} from '@ng-icons/ionicons';
import {ClipboardModule} from 'ngx-clipboard';
import {TooltipModule} from 'ngx-bootstrap/tooltip';
import {ToastrModule} from 'ngx-toastr';
import {ModalModule} from 'ngx-bootstrap/modal';
import {CollapseModule} from 'ngx-bootstrap/collapse';
import {PopoverModule} from 'ngx-bootstrap/popover';
import {BsDropdownModule} from 'ngx-bootstrap/dropdown';
import {BsDatepickerModule} from 'ngx-bootstrap/datepicker';
import {TimepickerModule} from 'ngx-bootstrap/timepicker';
import {LoadingBarModule} from '@ngx-loading-bar/core';
import {LeafletModule} from '@bluehalo/ngx-leaflet';
import {LeafletMarkerClusterModule} from '@bluehalo/ngx-leaflet-markercluster';
import {MarkdownModule} from 'ngx-markdown';
import {AppComponent} from './app/app.component';
import {Marker} from 'leaflet';
import {MarkerFactory} from './app/ui/gallery/map/MarkerFactory';
import {DurationPipe} from './app/pipes/DurationPipe';
import {GalleryService} from './app/ui/gallery/gallery.service';
import {UploaderService} from './app/ui/gallery/uploader/uploader.service';

if (environment.production) {
  enableProdMode();
}

@Injectable()
export class MyHammerConfig extends HammerGestureConfig {
  events: string[] = ['pinch'];
  overrides = {
    pan: {threshold: 1},
    swipe: {direction: 31}, // enable swipe up
    pinch: {enable: true},
  };
}


export class CustomUrlSerializer implements UrlSerializer {
  private defaultUrlSerializer: DefaultUrlSerializer =
    new DefaultUrlSerializer();

  parse(url: string): UrlTree {
    // Encode parentheses
    url = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
    // Use the default serializer.
    return this.defaultUrlSerializer.parse(url);
  }

  serialize(tree: UrlTree): string {
    return this.defaultUrlSerializer
      .serialize(tree)
      .replace(/%28/g, '(')
      .replace(/%29/g, ')');
  }
}

Marker.prototype.options.icon = MarkerFactory.defIcon;

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule, HammerModule, FormsModule, AppRoutingModule, NgIconsModule.withIcons({
        ionDownloadOutline, ionFunnelOutline,
        ionGitBranchOutline, ionArrowDownOutline, ionArrowUpOutline,
        ionStarOutline, ionStar, ionCalendarOutline, ionPersonOutline, ionShuffleOutline,
        ionPeopleOutline,
        ionMenuOutline, ionShareSocialOutline,
        ionImagesOutline, ionLinkOutline, ionSearchOutline, ionHammerOutline, ionCopyOutline,
        ionAlbumsOutline, ionSettingsOutline, ionLogOutOutline,
        ionChevronForwardOutline, ionChevronDownOutline, ionChevronBackOutline,
        ionTrashOutline, ionSaveOutline, ionAddOutline, ionRemoveOutline,
        ionTextOutline, ionFolderOutline, ionDocumentOutline, ionDocumentTextOutline, ionImageOutline,
        ionPricetagOutline, ionLocationOutline,
        ionSunnyOutline, ionMoonOutline, ionVideocamOutline,
        ionInformationCircleOutline,
        ionInformationOutline, ionContractOutline, ionExpandOutline, ionCloseOutline,
        ionTimerOutline,
        ionPlayOutline, ionPauseOutline, ionVolumeMediumOutline, ionVolumeMuteOutline,
        ionCameraOutline, ionWarningOutline, ionLockClosedOutline, ionChevronUpOutline,
        ionFlagOutline, ionGlobeOutline, ionPieChartOutline, ionStopOutline,
        ionTimeOutline, ionCheckmarkOutline, ionPulseOutline, ionResizeOutline,
        ionCloudOutline, ionChatboxOutline, ionServerOutline, ionFileTrayFullOutline, ionBrushOutline,
        ionBrowsersOutline, ionUnlinkOutline, ionSquareOutline, ionGridOutline,
        ionAppsOutline, ionOpenOutline, ionRefresh, ionExtensionPuzzleOutline, ionList, ionPencil, ionReload,
        ionCaretForward, ionCaretDown,
        ionFingerPrint, ionCloudUploadOutline
      }), ClipboardModule, TooltipModule.forRoot(), ToastrModule.forRoot(),
      ModalModule.forRoot(), CollapseModule.forRoot(), PopoverModule.forRoot(),
      BsDropdownModule.forRoot(), BsDatepickerModule.forRoot(), TimepickerModule.forRoot(),
      LoadingBarModule, LeafletModule, LeafletMarkerClusterModule,
      MarkdownModule.forRoot({loader: HttpClient})),
    {provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true},
    {provide: UrlSerializer, useClass: CustomUrlSerializer},
    {provide: HAMMER_GESTURE_CONFIG, useClass: MyHammerConfig},
    StringifySortingMethod,
    NetworkService,
    ShareService,
    UserService,
    AlbumsService,
    GalleryCacheService,
    ContentService,
    ContentLoaderService,
    GalleryService,
    FilterService,
    GallerySortingService,
    GalleryNavigatorService,
    MapService,
    BlogService,
    SearchQueryParserService,
    AutoCompleteService,
    AuthenticationService,
    ThumbnailLoaderService,
    ThumbnailManagerService,
    NotificationService,
    FullScreenService,
    NavigationService,
    SettingsService,
    SeededRandomService,
    OverlayService,
    QueryService,
    ThemeService,
    DuplicateService,
    FacesService,
    VersionService,
    ScheduledJobsService,
    UploaderService,
    BackendtextService,
    CookieService,
    GPXFilesFilterPipe,
    MDFilesFilterPipe,
    FileSizePipe,
    DatePipe,
    DurationPipe,
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations()
  ]
})
  .catch((err) => console.error(err));
