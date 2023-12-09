import {Injectable} from '@angular/core';
import {NetworkService} from '../../../model/network/network.service';
import {FileDTO} from '../../../../../common/entities/FileDTO';
import {Utils} from '../../../../../common/Utils';
import {Config} from '../../../../../common/config/public/Config';
import {MapLayers, MapProviders,} from '../../../../../common/config/public/ClientConfig';
import {LatLngLiteral} from 'leaflet';

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

  public async getMapCoordinates(
      file: FileDTO
  ): Promise<{ name: string, path: LatLngLiteral[][]; markers: LatLngLiteral[] }> {
    const filePath = Utils.concatUrls(
        file.directory.path,
        file.directory.name,
        file.name
    );
    const gpx = await this.networkService.getXML(
        '/gallery/content/' + filePath + '/bestFit'
    );
    const getCoordinates = (inputElement: Document, tagName: string): LatLngLiteral[] => {
      const elements = inputElement.getElementsByTagName(tagName);
      const ret: LatLngLiteral[] = [];
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < elements.length; i++) {
        ret.push({
          lat: parseFloat(elements[i].getAttribute('lat')),
          lng: parseFloat(elements[i].getAttribute('lon')),
        });
      }
      return ret;
    };
    const trksegs = gpx.getElementsByTagName('trkseg');
    if (!trksegs) {

      return {
        name: gpx.getElementsByTagName('name')?.[0]?.textContent || '',
        path: [getCoordinates(gpx, 'trkpt')],
        markers: getCoordinates(gpx, 'wpt'),
      };
    }
    const trksegArr = [].slice.call(trksegs);
    return {
      name: gpx.getElementsByTagName('name')?.[0]?.textContent || '',
      path: [...trksegArr].map(t => getCoordinates(t, 'trkpt')),
      markers: getCoordinates(gpx, 'wpt'),
    };
  }
}

