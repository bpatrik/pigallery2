import {Component, ElementRef, Input, type OnChanges, ViewChild, ChangeDetectionStrategy} from '@angular/core';
import {type PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {type Dimension, type IRenderable} from '../../../model/IRenderable';
import {GalleryMapLightboxComponent} from './lightbox/lightbox.map.gallery.component';
import {type FileDTO} from '../../../../../common/entities/FileDTO';
import {MapService} from './map.service';
import {Config} from '../../../../../common/config/public/Config';
import {type LatLngLiteral, Map, type MapOptions, Marker, marker, tileLayer, TileLayer} from 'leaflet';
import {ThemeService} from '../../../model/theme.service';
import {Subscription} from 'rxjs';
import {MarkerFactory} from './MarkerFactory';
import {LeafletModule} from '@bluehalo/ngx-leaflet';
import {QueryService} from '../../../model/query.service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-gallery-map',
  templateUrl: './map.gallery.component.html',
  styleUrls: ['./map.gallery.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [GalleryMapLightboxComponent, LeafletModule]
})
export class GalleryMapComponent implements OnChanges, IRenderable {
  @Input() photos: PhotoDTO[];
  @Input() gpxFiles: FileDTO[];
  @ViewChild(GalleryMapLightboxComponent, {static: false})
  mapLightbox: GalleryMapLightboxComponent;
  @ViewChild('map', {static: false}) mapElement: ElementRef;

  leafletMap: Map;
  layers: { light: TileLayer, dark: TileLayer };

  options: MapOptions = {
    zoomControl: false,
    dragging: false,
    keyboard: false,
    tapHold: false,
    doubleClickZoom: false,
    boxZoom: false,
    zoom: 0,
    center: [0, 0],
  };
  markerLayer: Marker[] = [];
  darkModeSubscription: Subscription;

  constructor(public mapService: MapService,
              private queryService: QueryService,
              private router: Router,
              private themeService: ThemeService) {
    this.initThemeModes();
  }

  ngOnDestroy(): void {
    this.darkModeSubscription.unsubscribe();
  }

  initThemeModes() {
    this.layers = {
      'light': tileLayer(this.mapService.MapLayer.url, {
        attribution: this.mapService.ShortAttributions,
      }),
      'dark':
        tileLayer(this.mapService.DarkMapLayer.url, {
          attribution: this.mapService.ShortAttributions,
        })
    };
    if (this.themeService.darkMode.value) {
      this.options.layers = [this.layers.dark];
    } else {
      this.options.layers = [this.layers.light];
    }
    // update map theme on dark theme
    this.darkModeSubscription = this.themeService.darkMode.subscribe((isDark) => {
      if (!this.leafletMap) {
        return;
      }

      if (isDark) {
        if (this.leafletMap.hasLayer(this.layers.dark)) {
          return;
        }
        this.leafletMap.removeLayer(this.layers.light);
        this.leafletMap.addLayer(this.layers.dark);
      } else {
        if (this.leafletMap.hasLayer(this.layers.light)) {
          return;
        }
        this.leafletMap.removeLayer(this.layers.dark);
        this.leafletMap.addLayer(this.layers.light);
      }
    });
  }

  onMapReady(map: Map): void {
    this.leafletMap = map;
    if (!this.leafletMap) {
      return;
    }
    if (this.markerLayer.length > 0) {
      this.leafletMap.setView(this.markerLayer[0].getLatLng(), 99);
      this.leafletMap.fitBounds(
        this.markerLayer.map(
          (mp): [number, number] =>
            [mp.getLatLng().lat, mp.getLatLng().lng] as [number, number]
        )
      );
    }
    this.leafletMap.setZoom(0);
  }

  ngOnChanges(): void {
    this.markerLayer = this.photos
      .filter((p): number => {
        return (
          p.metadata &&
          p.metadata.positionData &&
          p.metadata.positionData.GPSData &&
          p.metadata.positionData.GPSData.latitude &&
          p.metadata.positionData.GPSData.longitude
        );
      })
      .slice(0, Config.Map.maxPreviewMarkers)
      .map((p): Marker => {
        return marker({
          lat: p.metadata.positionData.GPSData.latitude,
          lng: p.metadata.positionData.GPSData.longitude,
        } as LatLngLiteral).setIcon(MarkerFactory.defIconSmall);
      });

    if (this.leafletMap && this.markerLayer.length > 0) {
      this.options.center = this.markerLayer[0].getLatLng();
      this.leafletMap.setView(this.markerLayer[0].getLatLng(), 99);
      this.leafletMap.fitBounds(
        this.markerLayer.map(
          (mp): [number, number] =>
            [mp.getLatLng().lat, mp.getLatLng().lng] as [number, number]
        )
      );
      this.leafletMap.setZoom(0);
    }
  }

  click(): void {
    this.router.navigate([], {
      queryParams: this.queryService.getParams({map:true}),
    });
  }

  public getDimension(): Dimension {
    if (isNaN(this.mapElement?.nativeElement?.parentElement?.offsetParent.offsetTop)) {
      return {top: 0, left: 0, width: 0, height: 0};
    }
    return {
      top: this.mapElement.nativeElement?.parentElement?.offsetParent?.offsetTop,
      left: this.mapElement.nativeElement?.parentElement?.offsetLeft,
      width: this.mapElement.nativeElement?.offsetWidth,
      height: this.mapElement.nativeElement?.offsetHeight,
    } as Dimension;
  }
}

