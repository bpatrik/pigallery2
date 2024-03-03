import {IConfigClass} from 'typeconfig/common';
import {Config, PrivateConfigClass} from '../../../common/config/private/Config';
import {ConfigClassBuilder} from 'typeconfig/node';
import {IExtensionConfig} from './IExtension';
import {Utils} from '../../../common/Utils';
import {ObjectManagers} from '../ObjectManagers';

/**
 * Wraps to original config and makes sure all extension related config is loaded
 */
export class ExtensionConfigWrapper {
  static async original(): Promise<PrivateConfigClass & IConfigClass> {
    const pc = ConfigClassBuilder.attachPrivateInterface(new PrivateConfigClass());
    try {
      await pc.load();
      if (ObjectManagers.isReady()) {
        for (const ext of Object.values(ObjectManagers.getInstance().ExtensionManager.extObjects)) {
          ext.config.loadToConfig(ConfigClassBuilder.attachPrivateInterface(pc));
        }
      }
    } catch (e) {
      console.error('Error during loading original config. Reverting to defaults.');
      console.error(e);
    }
    return pc;
  }
}

export class ExtensionConfig<C> implements IExtensionConfig<C> {
  public template: new() => C;

  constructor(private readonly extensionId: string) {
  }

  public getConfig(): C {
    return Config.Extensions.configs[this.extensionId] as C;
  }

  public setTemplate(template: new() => C): void {
    this.template = template;
    this.loadToConfig(Config);
  }

  loadToConfig(config: PrivateConfigClass) {
    if (!this.template) {
      return;
    }
    const conf = ConfigClassBuilder.attachPrivateInterface(new this.template());
    conf.__loadJSONObject(Utils.clone(config.Extensions.configs[this.extensionId] || {}));
    config.Extensions.configs[this.extensionId] = conf;
  }
}
