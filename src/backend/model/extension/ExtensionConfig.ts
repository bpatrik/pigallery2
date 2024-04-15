import {IExtensionConfig} from './IExtension';
import {Config} from '../../../common/config/private/Config';

export class ExtensionConfig<C> implements IExtensionConfig<C> {

  constructor(private readonly extensionFolder: string) {
  }


  public getConfig(): C {
    const c = (Config.Extensions.extensions || [])
      .find(e => e.path === this.extensionFolder);

    return c?.configs as C;
  }


}
