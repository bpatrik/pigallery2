import {GPSMetadata} from '../../../common/entities/PhotoDTO';
import NodeGeocoder from 'node-geocoder';
import {LocationLookupException} from '../../exceptions/LocationLookupException';
import {LRU} from '../../../common/Utils';
import {IObjectManager} from './IObjectManager';

export class LocationManager implements IObjectManager {
  // Only declared so TypeScript sees that the class implements the (otherwise all optional) interface.
  readonly onNewDataVersion?: IObjectManager['onNewDataVersion'];
  readonly geocoder: NodeGeocoder.Geocoder;
  cache = new LRU<GPSMetadata>(100);

  constructor() {
    this.geocoder = NodeGeocoder({provider: 'openstreetmap'});
  }

  async getGPSData(text: string): Promise<GPSMetadata> {
    let gps = this.cache.get(text);
    if (!gps) {
      const ret = await this.geocoder.geocode(text);
      if (ret.length < 1) {
        throw new LocationLookupException('Cannot find location:' + text, text);
      }
      gps = {
        latitude: ret[0].latitude,
        longitude: ret[0].longitude,
      };
      this.cache.set(text, gps);
    }

    return gps;
  }
}
