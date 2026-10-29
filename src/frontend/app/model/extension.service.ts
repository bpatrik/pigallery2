import {Injectable} from '@angular/core';
import {UIExtensionDTO} from '../../../common/entities/extension/IClientUIConfig';
import {getInjectedUIExtensionConfigs} from './server-inject';

@Injectable({
  providedIn: 'root'
})
export class ExtensionService {
  public readonly UIExtensionConfig: UIExtensionDTO[];

  constructor() {
    this.UIExtensionConfig = getInjectedUIExtensionConfigs();
  }

}
