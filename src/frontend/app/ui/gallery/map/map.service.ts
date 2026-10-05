import {Injectable} from '@angular/core';
import {NetworkService} from '../../../model/network/network.service';
import {type FileDTO} from '../../../../../common/entities/FileDTO';
import {Utils} from '../../../../../common/Utils';
import {Config} from '../../../../../common/config/public/Config';
import {MapLayers, MapProviders,} from '../../../../../common/config/public/ClientConfig';
import {LatLng, type LatLngLiteral} from 'leaflet';

interface GpxStats {
  distance: number; // in meters
  duration: number; // in seconds
  averageSpeed: number; // in km/h
}

@Injectable()
export class MapService {
  private static readonly OSMLAYERS: MapLayers[] = [
    {
      name: 'street',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      darkLayer: false
    },
  ];
  private static MAPBOXLAYERS: MapLayers[] = [];

  constructor(private networkService: NetworkService) {
    MapService.MAPBOXLAYERS = [
      {
        name: $localize`street`,
        url:
          'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=' +
          Config.Map.mapboxAccessToken,
        darkLayer: false
      },
      {
        name: $localize`satellite`,
        url:
          'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=' +
          Config.Map.mapboxAccessToken,
        darkLayer: false
      },
      {
        name: $localize`hybrid`,
        url:
          'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}?access_token=' +
          Config.Map.mapboxAccessToken,
        darkLayer: false
      },
      {
        name: $localize`dark`,
        url:
          'https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/256/{z}/{x}/{y}?access_token=' +
          Config.Map.mapboxAccessToken,
        darkLayer: true
      },
    ];
  }

  public get ShortAttributions(): string {
    const OSM = '<a href="https://www.openstreetmap.org/copyright">OSM</a>';
    const MB = '<a href="https://www.mapbox.com/">Mapbox</a>';

    if (Config.Map.mapProvider === MapProviders.OpenStreetMap) {
      return '  &copy; ' + OSM;
    }

    if (Config.Map.mapProvider === MapProviders.Mapbox) {
      return OSM + ' | ' + MB;
    }
    return '';
  }

  public get Attributions(): string {
    const OSM =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    const MB = '&copy; <a href="https://www.mapbox.com/">Mapbox</a>';

    if (Config.Map.mapProvider === MapProviders.OpenStreetMap) {
      return OSM;
    }

    if (Config.Map.mapProvider === MapProviders.Mapbox) {
      return OSM + ' | ' + MB;
    }
    return '';
  }

  public get MapLayer(): MapLayers {
    return (this.Layers.find(ml => !ml.darkLayer) || this.Layers[0]);
  }

  public get DarkMapLayer(): MapLayers {
    return (this.Layers.find(ml => ml.darkLayer) || this.MapLayer);
  }

  public get Layers(): MapLayers[] {
    switch (Config.Map.mapProvider) {
      case MapProviders.Custom:
        return Config.Map.customLayers;
      case MapProviders.Mapbox:
        return MapService.MAPBOXLAYERS;
      case MapProviders.OpenStreetMap:
        return MapService.OSMLAYERS;
    }
  }

  private calculateGpxStats(path: (LatLngLiteral & { time?: string }) []): GpxStats {
    if (!path || path.length < 2) {
      return {distance: 0, duration: 0, averageSpeed: 0};
    }

    let totalDistance = 0;
    let startTime: Date | null = null;
    let endTime: Date | null = null;

    // Calculate distance
    for (let i = 0; i < path.length - 1; i++) {
      const point1 = new LatLng(path[i].lat, path[i].lng);
      const point2 = new LatLng(path[i + 1].lat, path[i + 1].lng);
      totalDistance += point1.distanceTo(point2);
    }

    // Try to get time from GPX points if available
    if (path[0]['time']) {
      startTime = new Date(path[0]['time']);
      endTime = new Date(path[path.length - 1]['time']);
    }

    let duration = startTime && endTime ? (endTime.getTime() - startTime.getTime()) / 1000 : 0;
    // should be at least 1 second
    if (duration < 1000) {
      duration = 0;
    }
    const averageSpeed = duration > 0 ? (totalDistance / duration) * 3.6 : 0; // Convert m/s to km/h

    return {
      distance: totalDistance,
      duration: duration,
      averageSpeed: averageSpeed
    };
  }

  public async getMapCoordinates(
    file: FileDTO
  ): Promise<{
    name: string,
    author?: string,
    description?: string,
    path: LatLngLiteral[][],
    markers: LatLngLiteral[],
    stats?: GpxStats
  }> {
    const filePath = Utils.concatUrls(
      file.directory.path,
      file.directory.name,
      file.name
    );
    const gpx = await this.networkService.getXML(
      '/gallery/content/' + filePath + '/bestFit'
    );

    // Look for name in metadata first, then in track
    let name = '';
    const metadata = gpx.getElementsByTagName('metadata')?.[0];
    // Only look for direct name children of metadata, don't include author>name
    const metadataName = Array.from(metadata?.children || [])
      .find(child => child.tagName === 'name')?.textContent;
    const trkName = gpx.getElementsByTagName('trk')?.[0]?.getElementsByTagName('name')?.[0]?.textContent;
    name = metadataName || trkName || '';

    // Get author from metadata
    const author = gpx.getElementsByTagName('metadata')?.[0]?.getElementsByTagName('author')?.[0]?.getElementsByTagName('name')?.[0]?.textContent;

    // Get description from metadata
    const description = Array.from(metadata?.children || [])
      .find(child => child.tagName === 'desc')?.textContent;

    const getCoordinates = (inputElement: Document, tagName: string): (LatLngLiteral & { time?: string })[] => {
      const elements = inputElement.getElementsByTagName(tagName);
      const ret: LatLngLiteral[] = [];
      for (let i = 0; i < elements.length; i++) {
        const point: LatLngLiteral & { time?: string } = {
          lat: parseFloat(elements[i].getAttribute('lat')),
          lng: parseFloat(elements[i].getAttribute('lon'))
        };
        // Get time if available
        const timeElement = elements[i].getElementsByTagName('time')[0];
        if (timeElement) {
          point.time = timeElement.textContent;
        }
        ret.push(point);
      }
      return ret;
    };
    const trksegs = gpx.getElementsByTagName('trkseg');
    if (!trksegs) {
      const path = [getCoordinates(gpx, 'trkpt')];
      return {
        name,
        author,
        description,
        path,
        markers: getCoordinates(gpx, 'wpt')
      };
    }
    const trksegArr = [].slice.call(trksegs);
    const paths = [...trksegArr].map(t => getCoordinates(t, 'trkpt'));

    // Calculate combined stats for all path segments
    const combinedPath = paths.flat();
    const stats = this.calculateGpxStats(combinedPath);

    return {
      name,
      author,
      description,
      path: paths,
      markers: getCoordinates(gpx, 'wpt'),
      stats
    };
  }
}
