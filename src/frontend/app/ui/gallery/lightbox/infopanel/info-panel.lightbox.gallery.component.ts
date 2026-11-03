import { Component, computed, inject, output, input, ChangeDetectionStrategy } from '@angular/core';
import {CameraMetadata, PhotoDTO, PhotoMetadata, PositionMetaData,} from '../../../../../../common/entities/PhotoDTO';
import {Config} from '../../../../../../common/config/public/Config';
import {MediaDTO, MediaDTOUtils,} from '../../../../../../common/entities/MediaDTO';
import {VideoDTO, VideoMetadata,} from '../../../../../../common/entities/VideoDTO';
import {Utils} from '../../../../../../common/Utils';
import {QueryService} from '../../../../model/query.service';
import {MapService} from '../../map/map.service';
import {MarkerFactory} from '../../map/MarkerFactory';
import {
  ANDSearchQuery,
  type DistanceSearch, type DateSearch,
  SearchQueryTypes,
} from '../../../../../../common/entities/SearchQueryDTO';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {LatLngLiteral, marker, Marker, TileLayer, tileLayer} from 'leaflet';
import {ThemeService} from '../../../../model/theme.service';
import {ContentLoaderService} from '../../contentLoader.service';
import { DatePipe } from '@angular/common';
import {NgIconComponent} from '@ng-icons/core';
import {RouterLink} from '@angular/router';
import {LeafletModule} from '@bluehalo/ngx-leaflet';
import {DurationPipe} from '../../../../pipes/DurationPipe';
import {FileSizePipe} from '../../../../pipes/FileSizePipe';
import {TextSearchLinkPipe} from '../../../../pipes/TextSearchLinkPipe';
import {SearchQueryUtils} from '../../../../../../common/SearchQueryUtils';

@Component({
  selector: 'app-info-panel',
  styleUrl: './info-panel.lightbox.gallery.component.css',
  templateUrl: './info-panel.lightbox.gallery.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    NgIconComponent,
    RouterLink,
    LeafletModule,
    DatePipe,
    DurationPipe,
    FileSizePipe,
    TextSearchLinkPipe
]
})
export class InfoPanelLightboxComponent {
  queryService = inject(QueryService);
  contentLoaderService = inject(ContentLoaderService);
  mapService = inject(MapService);
  private authService = inject(AuthenticationService);
  private themeService = inject(ThemeService);

  readonly media = input<MediaDTO>(undefined);
  readonly closed = output();

  public readonly mapEnabled: boolean;
  public readonly searchEnabled: boolean;
  public readonly SearchQueryTypes: typeof SearchQueryTypes = SearchQueryTypes;

  public baseLayer: TileLayer;
  public readonly markerLayer = computed((): Marker[] => {
    if (!this.hasGPS()) {
      return [];
    }
    return [
      marker({
        lat: this.positionData().GPSData.latitude,
        lng: this.positionData().GPSData.longitude,
      } as LatLngLiteral, {icon: MarkerFactory.defIcon}),
    ];
  });

  constructor() {
    this.mapEnabled = Config.Map.enabled;
    this.searchEnabled = this.authService.canSearch();
    if (this.themeService.darkMode()) {
      this.baseLayer = tileLayer(this.mapService.DarkMapLayer.url, {
        attribution: this.mapService.ShortAttributions,
      });
    } else {
      this.baseLayer = tileLayer(this.mapService.MapLayer.url, {
        attribution: this.mapService.ShortAttributions,
      });
    }
  }

  public readonly directoryPath = computed((): string => Utils.concatUrls(
    this.media().directory.path,
    this.media().directory.name
  ));

  public readonly directoryPathStr = computed((): string => {
    const p = this.directoryPath();
    if (p === '.') {
      return $localize`Home`;
    }
    if (p.length > 25) {
      return '...' + p.slice(-22);
    }
    return p;
  });

  public readonly videoData = computed((): VideoMetadata => {
    if (typeof (this.media() as VideoDTO).metadata.bitRate === 'undefined') {
      return null;
    }
    return (this.media() as VideoDTO).metadata;
  });

  public readonly rating = computed((): number => (this.media() as PhotoDTO).metadata.rating);
  // the filled and the empty stars of the rating
  public readonly ratingStars = computed((): { filled: undefined[], empty: undefined[] } => ({
    filled: new Array(this.rating()),
    empty: new Array(5 - this.rating())
  }));

  public readonly positionData = computed((): PositionMetaData => (this.media() as PhotoDTO).metadata.positionData);

  public readonly cameraData = computed((): CameraMetadata => (this.media() as PhotoDTO).metadata.cameraData);

  public readonly exposure = computed((): string | number => {
    const f = this.cameraData()?.exposure;
    if (f > 1) {
      return f;
    }
    return '1/' + Math.round(1 / f);
  });

  // the faces and keywords of the media, null if it has none
  public readonly keywords = computed((): { value: string; type: SearchQueryTypes }[] => {
    const metadata = this.media().metadata as PhotoMetadata;
    if (
      !(metadata.keywords && metadata.keywords.length > 0) &&
      !(metadata.faces && metadata.faces.length > 0)
    ) {
      return null;
    }
    let keywords: { value: string; type: SearchQueryTypes }[] = [];
    if (Config.Faces.enabled) {
      const names: string[] = (metadata.faces || []).map(
        (f): string => f.name
      );
      keywords = names
        .filter((name, index): boolean => names.indexOf(name) === index)
        .map((n): { type: SearchQueryTypes; value: string } => ({
          value: n,
          type: SearchQueryTypes.person,
        }));
    }
    return keywords.concat(
      (metadata.keywords || []).map(
        (k): { type: SearchQueryTypes; value: string } => ({
          value: k,
          type: SearchQueryTypes.keyword,
        })
      )
    );
  });

  public readonly isPhoto = computed((): boolean => {
    const media = this.media();
    return media && MediaDTOUtils.isPhoto(media);
  });

  public readonly isLivePhoto = computed((): boolean => !!this.media()?.liveVideoPath);

  public readonly mpx = computed((): string => (
    (this.media().metadata.size.width * this.media().metadata.size.height) /
    1000000
  ).toFixed(2));

  public readonly isThisYear = computed((): boolean => MediaDTOUtils.createdThisYear(this.media()));

  public readonly positionParts = computed((): string[] => {
    const positionData = this.positionData();
    if (!positionData) {
      return [];
    }
    return [
      positionData.city,
      positionData.state,
      positionData.country
    ].filter(text => !!text);
  });

  public readonly hasTextPositionData = computed((): boolean => this.positionParts().length > 0);

  public readonly hasGPS = computed((): boolean => !!(
    (this.media() as PhotoDTO).metadata.positionData &&
    (this.media() as PhotoDTO).metadata.positionData.GPSData &&
    (this.media() as PhotoDTO).metadata.positionData.GPSData.latitude &&
    (this.media() as PhotoDTO).metadata.positionData.GPSData.longitude
  ));

  //Filter removes empty elements, join concats the values separated by ', '
  public readonly positionText = computed((): string => this.positionParts().join(', ').trim());

  // the GPS coordinates as shown, only set if the media has GPS data
  public readonly gpsText = computed((): { latitude: string, longitude: string } => {
    if (!this.hasGPS()) {
      return null;
    }
    return {
      latitude: this.positionData().GPSData.latitude.toFixed(6),
      longitude: this.positionData().GPSData.longitude.toFixed(6)
    };
  });

  public readonly distanceSearchQuery = computed((): string => {
    if (!this.hasGPS()) {
      return null;
    }
    return SearchQueryUtils.urlify({
      type: SearchQueryTypes.distance,
      from: {
        GPSData: {
          latitude: this.positionData().GPSData.latitude,
          longitude: this.positionData().GPSData.longitude
        }
      },
      distance: 1 // 1km radius
    } as DistanceSearch);
  });

  public readonly dateSearchQuery = computed((): string => {
    // Search for photos taken on the same date (within 24 hours)
    const creationDate = new Date(this.media().metadata.creationDate);
    const startOfDay = new Date(creationDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(creationDate);
    endOfDay.setHours(23, 59, 59, 999);

    return SearchQueryUtils.urlify({
      type: SearchQueryTypes.date,
      min: startOfDay.getTime(),
      max: endOfDay.getTime()
    } as DateSearch);
  });

  close(): void {
    this.closed.emit();
  }

}
