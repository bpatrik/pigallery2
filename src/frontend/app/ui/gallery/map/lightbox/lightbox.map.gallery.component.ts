import {Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, ViewChild,} from '@angular/core';
import {PhotoDTO} from '../../../../../../common/entities/PhotoDTO';
import {Dimension} from '../../../../model/IRenderable';
import {FullScreenService} from '../../fullscreen.service';
import {IconThumbnail, Thumbnail, ThumbnailBase, ThumbnailManagerService,} from '../../thumbnailManager.service';
import {MediaIcon} from '../../MediaIcon';
import {Media} from '../../Media';
import {PageHelper} from '../../../../model/page.helper';
import {FileDTO} from '../../../../../../common/entities/FileDTO';
import {Utils} from '../../../../../../common/Utils';
import {Config} from '../../../../../../common/config/public/Config';
import {MapService} from '../map.service';
import {
  control,
  Control,
  DivIcon,
  divIcon,
  featureGroup,
  FeatureGroup,
  icon,
  latLng,
  LatLngBounds,
  LatLngLiteral,
  Map,
  MapOptions,
  Marker,
  marker,
  markerClusterGroup,
  MarkerClusterGroup,
  Point,
  polyline,
  tileLayer,
  TileLayer
} from 'leaflet';
import {LeafletControlLayersConfig} from '@asymmetrik/ngx-leaflet';
import {ThemeService} from '../../../../model/theme.service';
import {Subscription} from 'rxjs';
import {MarkerFactory} from '../MarkerFactory';
import {ionImageOutline, ionWarningOutline} from '@ng-icons/ionicons';


@Component({
  selector: 'app-gallery-map-lightbox',
  styleUrls: ['./lightbox.map.gallery.component.css'],
  templateUrl: './lightbox.map.gallery.component.html',
})
export class GalleryMapLightboxComponent implements OnChanges, OnDestroy {
  @Input() photos: PhotoDTO[];
  @Input() gpxFiles: FileDTO[];
  public lightboxDimension: Dimension = {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  } as Dimension;
  public mapDimension: Dimension = {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  } as Dimension;
  public visible = false;
  public controllersVisible = false;
  public opacity = 1.0;
  @ViewChild('root', {static: true}) elementRef: ElementRef;
  public mapOptions: MapOptions = {
    zoom: 2,
    // setting max zoom is needed to MarkerCluster https://github.com/Leaflet/Leaflet.markercluster/issues/611
    maxZoom: 2,
    center: latLng(0, 0),
  };
  defLayer: TileLayer;
  darkLayer: TileLayer;
  private smallIconSize = new Point(
    Config.Media.Photo.iconSize * 0.75,
    Config.Media.Photo.iconSize * 0.75
  );
  private iconSize = new Point(
    Config.Media.Photo.iconSize,
    Config.Media.Photo.iconSize
  );
  private usedIconSize = this.iconSize;
  private mapLayersControlOption: LeafletControlLayersConfig & {
    overlays: {
      Photos: MarkerClusterGroup;
      [name: string]: FeatureGroup;
    };
  } = {
    baseLayers: {},
    overlays: {
      Photos: markerClusterGroup({
        maxClusterRadius: 20,
        iconCreateFunction: (cluster) => {
          const childCount = cluster.getChildCount();
          let size: number;
          let c = ' marker-cluster-';
          if (childCount < 10) {
            c += 'small';
            size = 30;
          } else if (childCount < 100) {
            c += 'medium';
            size = 40;
          } else {
            c += 'large';
            size = 50;
          }

          return divIcon({
            html: '<div><span>' + childCount + '</span></div>',
            className: 'marker-cluster' + c,
            iconSize: new Point(size, size),
          });
        },
      }),
    },
  };
  // ordered list
  private pathLayersConfigOrdered: {
    name: string,
    layer: FeatureGroup,
    themes?: {
      matchers?: RegExp[],
      theme?: { color: string, dashArray: string },
      icon?: DivIcon
    }[],
  }[] = [];
  mapLayerControl: Control.Layers;
  private thumbnailsOnLoad: ThumbnailBase[] = [];
  private startPosition: Dimension = null;
  private leafletMap: Map;
  darkModeSubscription: Subscription;
  private longPathSEPairs: { [key: string]: number } = {}; // stores how often a long distance path pair comes up

  constructor(
    public fullScreenService: FullScreenService,
    private thumbnailService: ThumbnailManagerService,
    public mapService: MapService,
    private themeService: ThemeService
  ) {
    this.setUpPathLayers();
    this.mapOptions.layers = [this.mapLayersControlOption.overlays.Photos];
    this.pathLayersConfigOrdered.forEach(pl => this.mapOptions.layers.push(pl.layer));
    for (let i = 0; i < mapService.Layers.length; ++i) {
      const l = mapService.Layers[i];
      const tl = tileLayer(l.url, {attribution: mapService.Attributions});
      if (l.url === mapService.MapLayer.url) {
        this.defLayer = tl;
      }
      if (l.url === mapService.DarkMapLayer.url) {
        this.darkLayer = tl;
      }
      this.mapLayersControlOption.baseLayers[l.name] = tl;
    }
    if (!this.defLayer || !this.darkLayer) {
      throw new Error('Cant find default or dark layer');
    }
    this.mapOptions.layers.push(this.themeService.darkMode.value ? this.darkLayer : this.defLayer);

    this.mapLayerControl = control.layers(
      this.mapLayersControlOption.baseLayers,
      this.mapLayersControlOption.overlays,
      {position: 'bottomright'}
    );

    // update map theme on dark theme
    this.darkModeSubscription = this.themeService.darkMode.subscribe(this.selectBaseLayer);
  }

  setUpPathLayers() {


    Config.Map.MapPathGroupConfig.forEach((conf) => {
      let nameI18n = conf.name;
      switch (conf.name) {
        case 'Sport':
          nameI18n = $localize`Sport`;
          break;
        case 'Transportation':
          nameI18n = $localize`Transportation`;
          break;
        case 'Other paths':
          nameI18n = $localize`Other paths`;
          break;
      }
      const pl = {
        name: nameI18n,
        layer: featureGroup([]),
        themes: conf.matchers.map(ths => {
          return {
            matchers: ths.matchers.map(s => new RegExp(s, 'i')),
            theme: ths.theme,
            icon: MarkerFactory.getSvgIcon({
              color: ths.theme.color,
              svgItems: ths.theme.svgIcon?.items,
              viewBox: ths.theme.svgIcon?.viewBox
            })
          };
        })
      };

      this.pathLayersConfigOrdered.push(pl);

    });
    if (this.pathLayersConfigOrdered.length === 0) {
      this.pathLayersConfigOrdered.push({name: $localize`Other paths`, layer: featureGroup([])});
    }

    this.pathLayersConfigOrdered.forEach(pl => {
      this.mapLayersControlOption.overlays[pl.name] = pl.layer;
    });
  }

  ngOnDestroy(): void {
    this.darkModeSubscription.unsubscribe();
  }

  private selectBaseLayer = () => {
    if (!this.leafletMap) {
      return;
    }
    if (this.leafletMap.hasLayer(this.defLayer) && this.themeService.darkMode.value) {
      this.leafletMap.removeLayer(this.defLayer);
      this.leafletMap.addLayer(this.darkLayer);
    }
    if (this.leafletMap.hasLayer(this.darkLayer) && !this.themeService.darkMode.value) {
      this.leafletMap.removeLayer(this.darkLayer);
      this.leafletMap.addLayer(this.defLayer);
    }
  };

  private static getScreenWidth(): number {
    return window.innerWidth;
  }

  private static getScreenHeight(): number {
    return window.innerHeight;
  }

  ngOnChanges(): void {
    if (this.visible === false) {
      return;
    }
    this.showImages();
  }

  @HostListener('window:resize', ['$event'])
  async onResize(): Promise<void> {
    this.lightboxDimension = {
      top: 0,
      left: 0,
      width: GalleryMapLightboxComponent.getScreenWidth(),
      height: GalleryMapLightboxComponent.getScreenHeight(),
    } as Dimension;
    this.mapDimension = {
      top: 0,
      left: 0,
      width: GalleryMapLightboxComponent.getScreenWidth(),
      height: GalleryMapLightboxComponent.getScreenHeight(),
    } as Dimension;
    await Utils.wait(0);
    this.leafletMap.invalidateSize();
  }

  public async show(position: Dimension): Promise<void> {
    this.clearMap();
    this.visible = true;
    this.opacity = 1.0;
    this.startPosition = position;
    this.lightboxDimension = Utils.clone(position);
    this.lightboxDimension.top -= PageHelper.ScrollY;
    this.mapDimension = {
      top: 0,
      left: 0,
      width: GalleryMapLightboxComponent.getScreenWidth(),
      height: GalleryMapLightboxComponent.getScreenHeight(),
    } as Dimension;
    this.showImages();
    //  this.centerMap();
    PageHelper.hideScrollY();
    await Utils.wait(0);
    this.lightboxDimension = {
      top: 0,
      left: 0,
      width: GalleryMapLightboxComponent.getScreenWidth(),
      height: GalleryMapLightboxComponent.getScreenHeight(),
    } as Dimension;
    await Utils.wait(350);
    this.leafletMap.invalidateSize();
    this.centerMap();
    this.controllersVisible = true;
  }

  public hide(): void {
    this.fullScreenService.exitFullScreen();
    this.controllersVisible = false;
    const to = this.startPosition;

    // if target image out of screen -> scroll to there
    if (
      PageHelper.ScrollY > to.top ||
      PageHelper.ScrollY + GalleryMapLightboxComponent.getScreenHeight() <
      to.top
    ) {
      PageHelper.ScrollY = to.top;
    }

    this.lightboxDimension = this.startPosition;
    this.lightboxDimension.top -= PageHelper.ScrollY;
    PageHelper.showScrollY();
    this.opacity = 0.0;
    setTimeout((): void => {
      this.visible = false;
      this.clearMap();
      this.leafletMap.setZoom(2);
    }, 500);
  }

  showImages(): void {
    this.clearImages();

    // make sure to enable photos layers when opening map
    if (
      this.leafletMap &&
      !this.leafletMap.hasLayer(this.mapLayersControlOption.overlays.Photos)
    ) {
      this.leafletMap.addLayer(this.mapLayersControlOption.overlays.Photos);
    }
    this.thumbnailsOnLoad = [];
    this.photos
      .filter((p): number => {
        return (
          p.metadata &&
          p.metadata.positionData &&
          p.metadata.positionData.GPSData &&
          p.metadata.positionData.GPSData.latitude &&
          p.metadata.positionData.GPSData.longitude
        );
      })
      .forEach((p): void => {
        const mkr = marker({
          lat: p.metadata.positionData.GPSData.latitude,
          lng: p.metadata.positionData.GPSData.longitude,
        });
        this.mapLayersControlOption.overlays.Photos.addLayer(mkr);
        let width = 500;
        let height = 500;
        const size = p.metadata.size;
        if (size.width > size.height) {
          height = width * (size.height / size.width);
        } else {
          width = height * (size.width / size.height);
        }
        const photoTh = this.thumbnailService.getLazyThumbnail(
          new Media(p, width, height)
        );
        this.thumbnailsOnLoad.push(photoTh);

        // Setting popup photo
        const setPopUpPhoto = () => {
          const photoPopup =
            `<img style="width: ${width}px; height: ${height}px" ` +
            `src="${photoTh.Src}" alt="preview">`;
          if (!mkr.getPopup()) {
            mkr.bindPopup(photoPopup, {minWidth: width});
          } else {
            mkr.setPopupContent(photoPopup);
          }
        };

        if (photoTh.Available) {
          setPopUpPhoto();
        } else {
          const noPhotoPopup = `<div class="lightbox-map-gallery-component-preview-loading"
                                 style="width: ${width}px; height: ${height}px">
                  ${photoTh.Error ? ionWarningOutline : ionImageOutline}
                  </div>`;

          mkr.bindPopup(noPhotoPopup, {minWidth: width});
          mkr.on('popupopen', () => {
            photoTh.load();
            photoTh.CurrentlyWaiting = true;
          });
          photoTh.OnLoad = setPopUpPhoto;
        }

        mkr.setIcon(MarkerFactory.defIcon);
        // Setting photo icon
        if (Config.Map.useImageMarkers === true) {
          mkr.on('add', () => {
            mkr.off('add');
            const iconTh = this.thumbnailService.getIcon(new MediaIcon(p));
            this.thumbnailsOnLoad.push(iconTh);
            iconTh.Visible = true;
            const setIcon = () => {
              mkr.setIcon(
                icon({
                  iconUrl: iconTh.Src,
                  iconSize: this.usedIconSize, // size of the icon
                  className: 'photo-icon',
                })
              );
              mkr.options.alt = p.name;
              mkr.on('mouseover', () => {
                mkr.getIcon().options.iconSize = [
                  this.usedIconSize.x * 1.5,
                  this.usedIconSize.y * 1.5,
                ];
                mkr.setIcon(mkr.getIcon());
              });
              mkr.on('mouseout', () => {
                mkr.getIcon().options.iconSize = this.usedIconSize;
                mkr.setIcon(mkr.getIcon());
              });
            };
            if (iconTh.Available === true) {
              setIcon();
            } else {
              iconTh.OnLoad = setIcon;
            }
          });
        }
      });
    if (this.gpxFiles) {
      this.loadGPXFiles().catch(console.error);
    }
  }

  public loadPreview(mp: MapPhoto): void {
    mp.preview.thumbnail.load();
    mp.preview.thumbnail.CurrentlyWaiting = true;
  }

  clearMap() {
    this.clearImages();
    this.clearPath();
  }

  clearImages(): void {
    this.thumbnailsOnLoad.forEach((th): void => {
      th.destroy();
    });
    this.thumbnailsOnLoad = [];

    this.mapLayersControlOption.overlays.Photos.clearLayers();
  }

  clearPath(): void {
    this.pathLayersConfigOrdered.forEach(p => {
      p.layer.clearLayers();
      this.mapLayerControl.removeLayer(
        p.layer
      );
    });
    this.longPathSEPairs = {};

  }

  @HostListener('window:keydown', ['$event'])
  onKeyPress(event: KeyboardEvent): void {
    if (this.visible !== true) {
      return;
    }
    switch (event.key) {
      case 'f':
      case 'F':
        if (this.fullScreenService.isFullScreenEnabled()) {
          this.fullScreenService.exitFullScreen();
        } else {
          this.fullScreenService.showFullScreen(this.elementRef.nativeElement);
        }
        break;
      case 'Escape':
        this.hide();
        break;
    }
  }

  onMapReady(map: Map): void {
    this.leafletMap = map;
    this.leafletMap.setMaxZoom(undefined);
    this.leafletMap.zoomControl.setPosition('bottomright');
    this.mapLayerControl.addTo(this.leafletMap);
  }

  onLeafletZoom(): void {
    if (Config.Map.useImageMarkers === false) {
      return;
    }
    if (
      (this.leafletMap.getZoom() < 15 &&
        this.usedIconSize === this.smallIconSize) ||
      (this.leafletMap.getZoom() >= 15 && this.usedIconSize === this.iconSize)
    ) {
      // all set no change needed
      return;
    }
    this.usedIconSize =
      this.leafletMap.getZoom() < 15 ? this.smallIconSize : this.iconSize;
    (
      this.mapLayersControlOption.overlays.Photos.getLayers() as Marker[]
    ).forEach((mkr) => {
      // if alt is not present icon is not yet set, so do not change the size
      if (!mkr.options.alt) {
        return;
      }
      mkr.getIcon().options.iconSize = this.usedIconSize;
      mkr.setIcon(mkr.getIcon());
    });
  }

  private centerMap(): void {
    let bounds: LatLngBounds = null;
    for (const k of Object.keys(this.mapLayersControlOption.overlays)) {
      const b = this.mapLayersControlOption?.overlays?.[k]?.getBounds();
      if (!b) {
        continue;
      }
      if (!bounds) {
        bounds = b;
        continue;
      }
      bounds.extend(b);
    }
    if (!bounds) {
      return;
    }
    this.leafletMap.fitBounds(bounds);
  }

  private addArchForLongDistancePaths(path: LatLngLiteral[]) {

    for (let i = 0; i < path.length - 1; ++i) {
      const dst = (a: LatLngLiteral, b: LatLngLiteral) => {
        return Math.sqrt(Math.pow(a.lat - b.lat, 2) +
          Math.pow(a.lng - b.lng, 2));
      };

      /**
       * Sort points then prints them as string
       * @param a
       * @param b
       */
      const getKey = (a: LatLngLiteral, b: LatLngLiteral) => {
        const KEY_PRECISION = 2;
        if (parseFloat(a.lat.toFixed(KEY_PRECISION)) > parseFloat(b.lat.toFixed(KEY_PRECISION))) {
          const tmp = b;
          b = a;
          a = tmp;
        } else if (a.lat.toFixed(KEY_PRECISION) == b.lat.toFixed(KEY_PRECISION)) { // let's keep string so no precision issue
          if (parseFloat(a.lng.toFixed(KEY_PRECISION)) > parseFloat(b.lng.toFixed(KEY_PRECISION))) {
            const tmp = b;
            b = a;
            a = tmp;
          }
        }
        return `${a.lat.toFixed(KEY_PRECISION)},${a.lng.toFixed(KEY_PRECISION)},${b.lat.toFixed(KEY_PRECISION)},${b.lng.toFixed(KEY_PRECISION)}`;

      };
      if (Math.abs(path[i].lng - path[i + 1].lng) > Config.Map.bendLongPathsTrigger) {
        const s = path[i];
        const e = path[i + 1];
        const k = getKey(s, e);
        this.longPathSEPairs[k] = (this.longPathSEPairs[k] || 0) + 1;
        const occurrence = this.longPathSEPairs[k] - 1;
        // transofrming occurrence to the following
        // 0, 1, -1, 2, -2, 3, -3;
        // 0, 1,  2, 3,  4, 6,  7;
        const multip = (((occurrence) % 2 == 1 ? 1 : -1) * Math.floor((occurrence + 1) / 2));
        const archScale = 0.3 + multip * 0.1;
        const d = dst(s, e); //start end distance
        const newPoints: LatLngLiteral[] = [];

        const N = Math.round(d / Config.Map.bendLongPathsTrigger); // number of new points
        const m: LatLngLiteral = { //mid point
          lat: (s.lat + e.lat) / 2,
          lng: (s.lng + e.lng) / 2,
        };
        const md = d / 2; // distance of the ends form mid point
        for (let j = 1; j < N; ++j) {
          const p = {
            lat: s.lat + (j / N) * (e.lat - s.lat),
            lng: s.lng + (j / N) * (e.lng - s.lng)
          };
          // simple pythagorean to have something like an arch.
          const a = dst(p, m);
          const c = md;
          const b = Math.sqrt(Math.pow(c, 2) - Math.pow(a, 2));
          p.lat += b * archScale;//* d10p;

          newPoints.push(p);
        }
        newPoints.forEach(mc => {

          const mkr = marker(mc);
          mkr.setIcon(MarkerFactory.defIconSmall);
        });

        path.splice(i + 1, 0, ...newPoints);
        i += newPoints.length;
      }
    }

  }


  private async loadGPXFiles(): Promise<void> {
    this.clearPath();
    if (this.gpxFiles.length === 0) {

      this.pathLayersConfigOrdered.forEach(p => {
        // remove from controls
        this.mapLayerControl.removeLayer(p.layer);
        // remove from map
        if (this.leafletMap) {
          this.leafletMap.removeLayer(p.layer);
        }

      });
      return;
    }

    const loadAFile = async (file: FileDTO) => {
      const parsedGPX = await this.mapService.getMapCoordinates(file);

      let pathLayer: { layer: FeatureGroup, icon?: DivIcon, theme?: { color?: string, dashArray?: string } };
      for (const pl of this.pathLayersConfigOrdered) {
        pathLayer = {layer: pl.layer, icon: MarkerFactory.defIcon};
        if (!pl.themes || pl.themes.length === 0) {
          break;
        }
        const th = pl.themes.find((th) => {
          return !th.matchers || th.matchers.length == 0 || // null/empty matchers match everything
            (parsedGPX.name &&
              th.matchers.findIndex(m => m.test(parsedGPX.name)) !== -1);
        });
        if (th) {
          pathLayer.theme = th.theme;
          pathLayer.icon = th.icon || pathLayer.icon;
          break;
        }
      }
      if (!pathLayer) {
        pathLayer = {layer: this.pathLayersConfigOrdered[0].layer, icon: MarkerFactory.defIcon};
      }

      if (parsedGPX.path.length !== 0 && parsedGPX.path[0].length !== 0) {
        // render the beginning of the path with a marker
        const mkr = marker(parsedGPX.path[0][0]);
        pathLayer.layer.addLayer(mkr);

        mkr.setIcon(pathLayer.icon);

        // Setting popup info
        mkr.bindPopup(file.name + ': ' + parsedGPX.name);

        //add arch for long paths
        parsedGPX.path.forEach(p => {
          this.addArchForLongDistancePaths(p);
          pathLayer.layer.addLayer(
            polyline(p, {
              smoothFactor: 3,
              interactive: false,
              color: pathLayer?.theme?.color,
              dashArray: pathLayer?.theme?.dashArray
            })
          );
        });


      }
      parsedGPX.markers.forEach((mc) => {
        const mkr = marker(mc);
        mkr.setIcon(pathLayer.icon);
        pathLayer.layer.addLayer(mkr);
        mkr.bindPopup($localize`Latitude` + ': ' + mc.lat + ', ' + $localize`longitude` + ': ' + mc.lng);
      });
    };

    await Promise.all(this.gpxFiles.map(f => loadAFile(f)));

    // Add layer to the map
    this.pathLayersConfigOrdered.filter(pl => pl.layer.getLayers().length > 0).forEach((pl) => {

      this.mapLayerControl.addOverlay(
        pl.layer,
        pl.name
      );
      if (
        this.leafletMap &&
        !this.leafletMap.hasLayer(pl.layer)
      ) {
        this.leafletMap.addLayer(pl.layer);
      }
    });
    // center map on paths if no photos to center map on
    if (!this.photos?.length) {
      this.centerMap();
    }
  }
}

export interface MapPhoto {
  name: string;
  lat: number;
  lng: number;
  iconUrl?: string;
  iconThumbnail: IconThumbnail;
  preview: {
    width: number;
    height: number;
    thumbnail: Thumbnail;
  };
}

