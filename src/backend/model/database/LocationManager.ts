import {GPSMetadata} from '../../../common/entities/PhotoDTO';
import NodeGeocoder from 'node-geocoder';
import {LocationLookupException} from '../../exceptions/LocationLookupException';
import {LRU} from '../../../common/Utils';
import {IObjectManager} from './IObjectManager';
import {Logger} from '../../Logger';

const LOG_TAG = '[LocationManager]';

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
      let ret: NodeGeocoder.Entry[];
      try {
        ret = await this.geocoder.geocode(text);
      } catch (e) {
        // e.g. no network or the service is down: for the user it is the same as a place that is not found (#1309)
        Logger.warn(LOG_TAG, 'Geocoding failed for: ' + text, e);
        throw new LocationLookupException('Cannot find location:' + text, text);
      }
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
