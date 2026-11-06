import { Component, ElementRef, OnChanges, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {type Dimension, IRenderable} from '../../../model/IRenderable';
import {GalleryMapLightboxComponent} from './lightbox/lightbox.map.gallery.component';
import {FileDTO} from '../../../../../common/entities/FileDTO';
import {MapService} from './map.service';
import {Config} from '../../../../../common/config/public/Config';
import {LatLngLiteral, Map, MapOptions, Marker, marker, tileLayer, TileLayer} from 'leaflet';
import {ThemeService} from '../../../model/theme.service';
import {MarkerFactory} from './MarkerFactory';
import {LeafletModule} from '@bluehalo/ngx-leaflet';
import {QueryService} from '../../../model/query.service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-gallery-map',
  templateUrl: './map.gallery.component.html',
  styleUrl: './map.gallery.component.css',
  imports: [GalleryMapLightboxComponent, LeafletModule]
})
export class GalleryMapComponent implements OnChanges, IRenderable {
  mapService = inject(MapService);
  private queryService = inject(QueryService);
  private router = inject(Router);
  private themeService = inject(ThemeService);

  readonly photos = input.required<PhotoDTO[]>();
  readonly gpxFiles = input.required<FileDTO[]>();
  readonly mapLightbox = viewChild(GalleryMapLightboxComponent);
  readonly mapElement = viewChild.required<ElementRef>('map');

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
  readonly markerLayer = computed((): Marker[] => this.photos()
    .flatMap((p): LatLngLiteral[] => {
      const gps = p.metadata?.positionData?.GPSData;
      return gps?.latitude && gps.longitude ? [{lat: gps.latitude, lng: gps.longitude}] : [];
    })
    .slice(0, Config.Map.maxPreviewMarkers)
    .map((latLng): Marker => marker(latLng).setIcon(MarkerFactory.defIconSmall)));

  constructor() {
    this.initThemeModes();
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
    if (this.themeService.darkMode()) {
      this.options.layers = [this.layers.dark];
    } else {
      this.options.layers = [this.layers.light];
    }
    // update map theme on dark theme
    // effect: swapping the Leaflet layer is an imperative call to a third-party library
    effect(() => {
      const isDark = this.themeService.darkMode();
      untracked(() => {
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
    });
  }

  onMapReady(map: Map): void {
    this.leafletMap = map;
    if (!this.leafletMap) {
      return;
    }
    if (this.markerLayer().length > 0) {
      this.leafletMap.setView(this.markerLayer()[0].getLatLng(), 99);
      this.leafletMap.fitBounds(
        this.markerLayer().map(
          (mp): [number, number] =>
            [mp.getLatLng().lat, mp.getLatLng().lng] as [number, number]
        )
      );
    }
    this.leafletMap.setZoom(0);
  }

  // Side effect: moves the Leaflet map to the new markers.
  ngOnChanges(): void {
    const markerLayer = this.markerLayer();
    if (this.leafletMap && markerLayer.length > 0) {
      this.options.center = markerLayer[0].getLatLng();
      this.leafletMap.setView(markerLayer[0].getLatLng(), 99);
      this.leafletMap.fitBounds(
        markerLayer.map(
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

  // an arrow function, so the map lightbox can call it
  public readonly getDimension = (): Dimension => {
    const mapElement = this.mapElement();
    if (isNaN(mapElement.nativeElement?.parentElement?.offsetParent?.offsetTop)) {
      return {top: 0, left: 0, width: 0, height: 0};
    }
    return {
      top: mapElement.nativeElement?.parentElement?.offsetParent?.offsetTop,
      left: mapElement.nativeElement?.parentElement?.offsetLeft,
      width: mapElement.nativeElement?.offsetWidth,
      height: mapElement.nativeElement?.offsetHeight,
    } as Dimension;
  };
}

