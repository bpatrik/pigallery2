import {Injectable, NgModule} from '@angular/core';
import {BrowserModule, HAMMER_GESTURE_CONFIG, HammerGestureConfig, HammerModule,} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {AppComponent} from './app.component';
import {UserService} from './model/network/user.service';
import {ContentService} from './ui/gallery/content.service';
import {NetworkService} from './model/network/network.service';
import {GalleryCacheService} from './ui/gallery/cache.gallery.service';
import {FullScreenService} from './ui/gallery/fullscreen.service';
import {AuthenticationService} from './model/network/authentication.service';
import {FrameComponent} from './ui/frame/frame.component';
import {LeafletModule} from '@asymmetrik/ngx-leaflet';
import {LoadingBarModule} from '@ngx-loading-bar/core';
import {GalleryLightboxMediaComponent} from './ui/gallery/lightbox/media/media.lightbox.gallery.component';
import {GalleryPhotoLoadingComponent} from './ui/gallery/grid/photo/loading/loading.photo.grid.gallery.component';
import {GalleryNavigatorComponent} from './ui/gallery/navigator/navigator.gallery.component';
import {GallerySearchComponent} from './ui/gallery/search/search.gallery.component';
import {GalleryLightboxComponent} from './ui/gallery/lightbox/lightbox.gallery.component';
import {GalleryDirectoryComponent} from './ui/gallery/directories/directory/directory.gallery.component';
import {GalleryGridComponent} from './ui/gallery/grid/grid.gallery.component';
import {GalleryPhotoComponent} from './ui/gallery/grid/photo/photo.grid.gallery.component';
import {LoginComponent} from './ui/login/login.component';
import {AdminComponent} from './ui/admin/admin.component';
import {GalleryComponent} from './ui/gallery/gallery.component';
import {StringifyRole} from './pipes/StringifyRolePipe';
import {GPXFilesFilterPipe} from './pipes/GPXFilesFilterPipe';
import {GalleryMapComponent} from './ui/gallery/map/map.gallery.component';
import {GalleryMapLightboxComponent} from './ui/gallery/map/lightbox/lightbox.map.gallery.component';
import {ThumbnailManagerService} from './ui/gallery/thumbnailManager.service';
import {OverlayService} from './ui/gallery/overlay.service';
import {GalleryShareComponent} from './ui/gallery/share/share.gallery.component';
import {ShareLoginComponent} from './ui/sharelogin/share-login.component';
import {ShareService} from './ui/gallery/share.service';
import {ModalModule} from 'ngx-bootstrap/modal';
import {BsDatepickerModule} from 'ngx-bootstrap/datepicker';
import {ToastrModule} from 'ngx-toastr';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {NotificationService} from './model/notification.service';
import {ClipboardModule} from 'ngx-clipboard';
import {NavigationService} from './model/navigation.service';
import {InfoPanelLightboxComponent} from './ui/gallery/lightbox/infopanel/info-panel.lightbox.gallery.component';
import {TooltipModule} from 'ngx-bootstrap/tooltip';
import {BsDropdownModule} from 'ngx-bootstrap/dropdown';
import {CollapseModule} from 'ngx-bootstrap/collapse';
import {PopoverModule} from 'ngx-bootstrap/popover';
import {SettingsService} from './ui/settings/settings.service';
import {HTTP_INTERCEPTORS, HttpClient, HttpClientModule,} from '@angular/common/http';
import {DefaultUrlSerializer, UrlSerializer, UrlTree} from '@angular/router';
import {LanguageComponent} from './ui/language/language.component';
import {QueryService} from './model/query.service';
import {StringifySortingMethod} from './pipes/StringifySortingMethod';
import {RandomQueryBuilderGalleryComponent} from './ui/gallery/random-query-builder/random-query-builder.gallery.component';
import {DurationPipe} from './pipes/DurationPipe';
import {MapService} from './ui/gallery/map/map.service';
import {ThumbnailLoaderService} from './ui/gallery/thumbnailLoader.service';
import {FileSizePipe} from './pipes/FileSizePipe';
import {DuplicateService} from './ui/duplicates/duplicates.service';
import {DuplicateComponent} from './ui/duplicates/duplicates.component';
import {DuplicatesPhotoComponent} from './ui/duplicates/photo/photo.duplicates.component';
import {SeededRandomService} from './model/seededRandom.service';
import {FacesComponent} from './ui/faces/faces.component';
import {FacesService} from './ui/faces/faces.service';
import {FaceComponent} from './ui/faces/face/face.component';
import {VersionService} from './model/version.service';
import {DirectoriesComponent} from './ui/gallery/directories/directories.component';
import {ControlsLightboxComponent} from './ui/gallery/lightbox/controls/controls.lightbox.gallery.component';
import {TimepickerModule} from 'ngx-bootstrap/timepicker';
import {TimeStampDatePickerComponent} from './ui/utils/timestamp-datepicker/datepicker.component';
import {TimeStampTimePickerComponent} from './ui/utils/timestamp-timepicker/timepicker.component';
import {ScheduledJobsService} from './ui/settings/scheduled-jobs.service';
import {BackendtextService} from './model/backendtext.service';
import {ErrorInterceptor} from './model/network/helper/error.interceptor';
import {CSRFInterceptor} from './model/network/helper/csrf.interceptor';
import {GallerySearchQueryEntryComponent} from './ui/gallery/search/query-enrty/query-entry.search.gallery.component';
import {StringifySearchQuery} from './pipes/StringifySearchQuery';
import {AutoCompleteService} from './ui/gallery/search/autocomplete.service';
import {SearchQueryParserService} from './ui/gallery/search/search-query-parser.service';
import {GallerySearchFieldBaseComponent} from './ui/gallery/search/search-field-base/search-field-base.gallery.component';
import {AppRoutingModule} from './app.routing';
import {CookieService} from 'ngx-cookie-service';
import {LeafletMarkerClusterModule} from '@asymmetrik/ngx-leaflet-markercluster';
import {Marker} from 'leaflet';
import {AlbumsComponent} from './ui/albums/albums.component';
import {AlbumComponent} from './ui/albums/album/album.component';
import {AlbumsService} from './ui/albums/albums.service';
import {GallerySearchQueryBuilderComponent} from './ui/gallery/search/query-builder/query-bulder.gallery.component';
import {SavedSearchPopupComponent} from './ui/albums/saved-search-popup/saved-search-popup.component';
import {MarkdownModule} from 'ngx-markdown';
import {GalleryBlogComponent} from './ui/gallery/blog/blog.gallery.component';
import {MDFilesFilterPipe} from './pipes/MDFilesFilterPipe';
import {FileDTOToPathPipe} from './pipes/FileDTOToPathPipe';
import {BlogService} from './ui/gallery/blog/blog.service';
import {PhotoFilterPipe} from './pipes/PhotoFilterPipe';
import {GallerySearchFieldComponent} from './ui/gallery/search/search-field/search-field.gallery.component';
import {GalleryFilterComponent} from './ui/gallery/filter/filter.gallery.component';
import {GallerySortingService} from './ui/gallery/navigator/sorting.service';
import {FilterService} from './ui/gallery/filter/filter.service';
import {TemplateComponent} from './ui/settings/template/template.component';
import {WorkflowComponent} from './ui/settings/workflow/workflow.component';
import {GalleryStatisticComponent} from './ui/settings/gallery-statistic/gallery-statistic.component';
import {JobButtonComponent} from './ui/settings/workflow/button/job-button.settings.component';
import {JobProgressComponent} from './ui/settings/workflow/progress/job-progress.settings.component';
import {SettingsEntryComponent} from './ui/settings/template/settings-entry/settings-entry.component';
import {UsersComponent} from './ui/settings/users/users.component';
import {SharingsListComponent} from './ui/settings/sharings-list/sharings-list.component';
import {ThemeService} from './model/theme.service';
import {StringifyEnum} from './pipes/StringifyEnum';
import {StringifySearchType} from './pipes/StringifySearchType';
import {MarkerFactory} from './ui/gallery/map/MarkerFactory';
import {IconComponent} from './icon.component';
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
  ionChatboxOutline,
  ionCheckmarkOutline,
  ionChevronBackOutline,
  ionChevronDownOutline,
  ionChevronForwardOutline,
  ionChevronUpOutline,
  ionCloseOutline,
  ionCloudOutline,
  ionContractOutline,
  ionCopyOutline,
  ionDocumentOutline,
  ionDocumentTextOutline,
  ionDownloadOutline,
  ionExpandOutline,
  ionFileTrayFullOutline,
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
  ionLocationOutline,
  ionLockClosedOutline,
  ionLogOutOutline,
  ionMenuOutline,
  ionMoonOutline,
  ionPauseOutline,
  ionPeopleOutline,
  ionPersonOutline,
  ionPieChartOutline,
  ionPlayOutline,
  ionPricetagOutline,
  ionPulseOutline,
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
import {SafeHtmlPipe} from './pipes/SafeHTMLPipe';
import {DatePipe} from '@angular/common';
import {ParseIntPipe} from './pipes/ParseIntPipe';
import {
  SortingMethodSettingsEntryComponent
} from './ui/settings/template/settings-entry/sorting-method/sorting-method.settings-entry.component';
import {ContentLoaderService} from './ui/gallery/contentLoader.service';
import {FileDTOToRelativePathPipe} from './pipes/FileDTOToRelativePathPipe';
import {StringifyGridSize} from './pipes/StringifyGridSize';
import {GalleryNavigatorService} from './ui/gallery/navigator/navigator.service';
import {GridSizeIconComponent} from './ui/utils/grid-size-icon/grid-size-icon.component';
import {SortingMethodIconComponent} from './ui/utils/sorting-method-icon/sorting-method-icon.component';

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

@NgModule({
  imports: [
    BrowserModule,
    HammerModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    NgIconsModule.withIcons({
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
      ionAppsOutline
    }),
    ClipboardModule,
    TooltipModule.forRoot(),
    ToastrModule.forRoot(),
    ModalModule.forRoot(),
    CollapseModule.forRoot(),
    PopoverModule.forRoot(),
    BsDropdownModule.forRoot(),
    BsDatepickerModule.forRoot(),
    TimepickerModule.forRoot(),
    LoadingBarModule,
    LeafletModule,
    LeafletMarkerClusterModule,
    MarkdownModule.forRoot({loader: HttpClient}),
  ],
  declarations: [
    AppComponent,
    IconComponent,
    LoginComponent,
    ShareLoginComponent,
    GalleryComponent,
    FacesComponent,
    // misc
    FrameComponent,
    LanguageComponent,
    TimeStampDatePickerComponent,
    TimeStampTimePickerComponent,
    // Albums
    AlbumsComponent,
    AlbumComponent,
    SavedSearchPopupComponent,
    // Gallery
    GalleryLightboxMediaComponent,
    GalleryPhotoLoadingComponent,
    GalleryGridComponent,
    GalleryDirectoryComponent,
    GalleryLightboxComponent,
    GalleryBlogComponent,
    GalleryMapComponent,
    GalleryMapLightboxComponent,
    FrameComponent,
    GallerySearchComponent,
    GallerySearchQueryEntryComponent,
    GallerySearchFieldBaseComponent,
    GallerySearchFieldComponent,
    GallerySearchQueryBuilderComponent,
    GalleryShareComponent,
    GalleryNavigatorComponent,
    GalleryFilterComponent,
    GalleryPhotoComponent,
    AdminComponent,
    InfoPanelLightboxComponent,
    ControlsLightboxComponent,
    RandomQueryBuilderGalleryComponent,
    DirectoriesComponent,
    // Face
    FaceComponent,
    // Duplicates
    DuplicateComponent,
    DuplicatesPhotoComponent,
    // Settings
    SettingsEntryComponent,
    TemplateComponent,
    JobProgressComponent,
    JobButtonComponent,
    WorkflowComponent,
    GalleryStatisticComponent,

    // Pipes
    StringifyRole,
    StringifySortingMethod,
    DurationPipe,
    FileSizePipe,
    GPXFilesFilterPipe,
    MDFilesFilterPipe,
    StringifySearchQuery,
    StringifyEnum,
    StringifySearchType,
    StringifyGridSize,
    FileDTOToPathPipe,
    FileDTOToRelativePathPipe,
    PhotoFilterPipe,
    ParseIntPipe,
    UsersComponent,
    SharingsListComponent,
    SortingMethodIconComponent,
    GridSizeIconComponent,
    SafeHtmlPipe,
    SortingMethodSettingsEntryComponent
  ],
  providers: [
    {provide: HTTP_INTERCEPTORS, useClass: CSRFInterceptor, multi: true},
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
    BackendtextService,
    CookieService,
    GPXFilesFilterPipe,
    MDFilesFilterPipe,
    FileSizePipe,
    DatePipe
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
