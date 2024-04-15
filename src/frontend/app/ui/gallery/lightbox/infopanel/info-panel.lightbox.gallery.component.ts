import {Component, EventEmitter, Input, OnChanges, OnInit, Output,} from '@angular/core';
import {CameraMetadata, PhotoDTO, PhotoMetadata, PositionMetaData,} from '../../../../../../common/entities/PhotoDTO';
import {Config} from '../../../../../../common/config/public/Config';
import {MediaDTO, MediaDTOUtils,} from '../../../../../../common/entities/MediaDTO';
import {VideoDTO, VideoMetadata,} from '../../../../../../common/entities/VideoDTO';
import {Utils} from '../../../../../../common/Utils';
import {QueryService} from '../../../../model/query.service';
import {MapService} from '../../map/map.service';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes,} from '../../../../../../common/entities/SearchQueryDTO';
import {AuthenticationService} from '../../../../model/network/authentication.service';
import {LatLngLiteral, marker, Marker, TileLayer, tileLayer} from 'leaflet';
import {ThemeService} from '../../../../model/theme.service';
import {ContentLoaderService} from '../../contentLoader.service';

@Component({
  selector: 'app-info-panel',
  styleUrls: ['./info-panel.lightbox.gallery.component.css'],
  templateUrl: './info-panel.lightbox.gallery.component.html',
})
export class InfoPanelLightboxComponent implements OnInit, OnChanges {
  @Input() media: MediaDTO;
  @Output() closed = new EventEmitter();

  public readonly mapEnabled: boolean;
  public readonly searchEnabled: boolean;
  public keywords: { value: string; type: SearchQueryTypes }[] = null;
  public readonly SearchQueryTypes: typeof SearchQueryTypes = SearchQueryTypes;

  public baseLayer: TileLayer;
  public markerLayer: Marker[] = [];

  constructor(
      public queryService: QueryService,
      public contentLoaderService: ContentLoaderService,
      public mapService: MapService,
      private authService: AuthenticationService,
      private themeService: ThemeService
  ) {
    this.mapEnabled = Config.Map.enabled;
    this.searchEnabled = this.authService.canSearch();
    if (this.themeService.darkMode.value) {
      this.baseLayer = tileLayer(mapService.DarkMapLayer.url, {
        attribution: mapService.ShortAttributions,
      });
    } else {
      this.baseLayer = tileLayer(mapService.MapLayer.url, {
        attribution: mapService.ShortAttributions,
      });
    }
  }

  get FullPath(): string {
    return Utils.concatUrls(
        this.media.directory.path,
        this.media.directory.name,
        this.media.name
    );
  }

  get DirectoryPath(): string {
    return Utils.concatUrls(
        this.media.directory.path,
        this.media.directory.name
    );
  }

  get DirectoryPathStr(): string {
    const p = this.DirectoryPath;
    if (p === '.') {
      return $localize`Home`;
    }
    if (p.length > 25) {
      return '...' + p.slice(-22);
    }
    return p;
  }

  get VideoData(): VideoMetadata {
    if (typeof (this.media as VideoDTO).metadata.bitRate === 'undefined') {
      return null;
    }
    return (this.media as VideoDTO).metadata;
  }

  get Rating(): number {
    return (this.media as PhotoDTO).metadata.rating;
  }

  get PositionData(): PositionMetaData {
    return (this.media as PhotoDTO).metadata.positionData;
  }

  get CameraData(): CameraMetadata {
    return (this.media as PhotoDTO).metadata.cameraData;
  }

  ngOnChanges(): void {
    if (this.hasGPS()) {
      this.markerLayer = [
        marker({
          lat: this.PositionData.GPSData.latitude,
          lng: this.PositionData.GPSData.longitude,
        } as LatLngLiteral),
      ];
    }
  }

  ngOnInit(): void {
    const metadata = this.media.metadata as PhotoMetadata;
    if (
        (metadata.keywords && metadata.keywords.length > 0) ||
        (metadata.faces && metadata.faces.length > 0)
    ) {
      this.keywords = [];
      if (Config.Faces.enabled) {
        const names: string[] = (metadata.faces || []).map(
            (f): string => f.name
        );
        this.keywords = names
            .filter((name, index): boolean => names.indexOf(name) === index)
            .map((n): { type: SearchQueryTypes; value: string } => ({
              value: n,
              type: SearchQueryTypes.person,
            }));
      }
      this.keywords = this.keywords.concat(
          (metadata.keywords || []).map(
              (k): { type: SearchQueryTypes; value: string } => ({
                value: k,
                type: SearchQueryTypes.keyword,
              })
          )
      );
    }
  }

  isPhoto(): boolean {
    return this.media && MediaDTOUtils.isPhoto(this.media);
  }

  calcMpx(): string {
    return (
        (this.media.metadata.size.width * this.media.metadata.size.height) /
        1000000
    ).toFixed(2);
  }

  isThisYear(): boolean {
    return (
        new Date().getFullYear() ===
        Utils.getUTCFullYear(this.media.metadata.creationDate, this.media.metadata.creationDateOffset)
    );
  }

  toFraction(f: number): string | number {
    if (f > 1) {
      return f;
    }
    return '1/' + Math.round(1 / f);
  }

  hasTextPositionData(): boolean {
    return (
        !!(this.media as PhotoDTO).metadata.positionData &&
        !!(
            (this.media as PhotoDTO).metadata.positionData.city ||
            (this.media as PhotoDTO).metadata.positionData.state ||
            (this.media as PhotoDTO).metadata.positionData.country
        )
    );
  }

  hasGPS(): boolean {
    return !!(
        (this.media as PhotoDTO).metadata.positionData &&
        (this.media as PhotoDTO).metadata.positionData.GPSData &&
        (this.media as PhotoDTO).metadata.positionData.GPSData.latitude &&
        (this.media as PhotoDTO).metadata.positionData.GPSData.longitude
    );
  }

  getPositionText(): string {
    if (!(this.media as PhotoDTO).metadata.positionData) {
      return '';
    }
    return [
      (this.media as PhotoDTO).metadata.positionData.city,
      (this.media as PhotoDTO).metadata.positionData.state,
      (this.media as PhotoDTO).metadata.positionData.country
    ].filter(elm => elm).join(', ').trim(); //Filter removes empty elements, join concats the values separated by ', '
  }

  close(): void {
    this.closed.emit();
  }

  getTextSearchQuery(name: string, type: SearchQueryTypes): string {
    return JSON.stringify({
      type,
      matchType: TextSearchQueryMatchTypes.exact_match,
      text: name,
    } as TextSearch);
  }
}

