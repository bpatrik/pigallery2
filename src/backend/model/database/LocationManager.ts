import {GPSMetadata} from '../../../common/entities/PhotoDTO';
import * as NodeGeocoder from 'node-geocoder';
import {LocationLookupException} from '../../exceptions/LocationLookupException';
import {LRU} from '../../../common/Utils';
import {IObjectManager} from './IObjectManager';
import {ParentDirectoryDTO} from '../../../common/entities/DirectoryDTO';

export class LocationManager implements IObjectManager {
  // onNewDataVersion only need for TypeScript, otherwise the interface is not implemented.
  readonly onNewDataVersion: (changedDir?: ParentDirectoryDTO) => Promise<void>;
  readonly geocoder: NodeGeocoder.Geocoder;
  cache = new LRU<GPSMetadata>(100);

  constructor() {
    this.geocoder = NodeGeocoder({provider: 'openstreetmap'});
  }

  async getGPSData(text: string): Promise<GPSMetadata> {
    if (!this.cache.get(text)) {
      const ret = await this.geocoder.geocode(text);
      if (ret.length < 1) {
        throw new LocationLookupException('Cannot find location:' + text, text);
      }
      this.cache.set(text, {
        latitude: ret[0].latitude,
        longitude: ret[0].longitude,
      });
    }

    return this.cache.get(text);
  }
}
