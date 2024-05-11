import {IExtensionConfig} from './IExtension';
import {Config} from '../../../common/config/private/Config';
import {ServerExtensionsEntryConfig} from '../../../common/config/private/subconfigs/ServerExtensionsConfig';

export class ExtensionConfig<C> implements IExtensionConfig<C> {

  constructor(private readonly extensionFolder: string) {
  }


  public getConfig(): C {
    const c = Config.Extensions.extensions[this.extensionFolder] as ServerExtensionsEntryConfig;

    return c?.configs as C;
  }


}
