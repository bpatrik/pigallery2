import {IExtensionApp} from './IExtension';
import {ObjectManagers} from '../ObjectManagers';
import {Config} from '../../../common/config/private/Config';
import {Server} from '../../server';

export class ExtensionApp implements IExtensionApp {
  get config() {
    return Config;
  }

  get expressApp() {
    return Server.getInstance().app;
  }

  get objectManagers() {
    return ObjectManagers.getInstance();
  }
}
