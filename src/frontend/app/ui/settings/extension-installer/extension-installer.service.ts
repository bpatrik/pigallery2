import { Injectable } from '@angular/core';
import {NetworkService} from '../../../model/network/network.service';
import {type ExtensionListItem} from '../../../../../common/entities/extension/ExtensionListItem';

@Injectable({
  providedIn: 'root'
})
export class ExtensionInstallerService {

  constructor(private networkService: NetworkService) {
  }

  public getExtensions(): Promise<Array<ExtensionListItem>> {
    return this.networkService.getJson('/extension/list');
  }

  public installExtension(extensionId: string): Promise<void> {
    return this.networkService.postJson('/extension/install', {id: extensionId});
  }

  public reloadExtension(extensionPath: string): Promise<void> {
    return this.networkService.postJson('/extension/reload', {path: extensionPath});
  }

  public deleteExtension(extensionPath: string): Promise<void> {
    return this.networkService.postJson('/extension/delete', {path: extensionPath});
  }
}
