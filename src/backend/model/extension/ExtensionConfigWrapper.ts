import {IConfigClass} from 'typeconfig/common';
import {PrivateConfigClass} from '../../../common/config/private/PrivateConfigClass';
import {ConfigClassBuilder} from 'typeconfig/node';
import {ExtensionConfigTemplateLoader} from './ExtensionConfigTemplateLoader';
import {NotificationManager} from '../NotifocationManager';


const LOG_TAG = '[ExtensionConfigWrapper]';

/**
 * Wraps to original config and makes sure all extension related config is loaded
 */
export class ExtensionConfigWrapper {

  static async original(showDetailedError = false): Promise<PrivateConfigClass & IConfigClass> {
    const pc = ConfigClassBuilder.attachPrivateInterface(new PrivateConfigClass());
    ExtensionConfigTemplateLoader.Instance.loadExtensionTemplates(pc);
    try {
      await pc.load(); // loading the basic configs, but we do not know the extension config hierarchy yet

    } catch (e) {
      console.error(LOG_TAG, 'Error during loading config. Reverting to defaults.');
      console.error(e);
      if (showDetailedError) {
        console.error(LOG_TAG, 'This is most likely due to: 1) you added a bad configuration in the server.json OR 2) The configuration changed in the latest release.');
        NotificationManager.error('Can\'t load config. Reverting to default. This is most likely due to: 1) you added a bad configuration in the server.json OR 2) The configuration changed in the latest release.', (e.toString ? e.toString() : JSON.stringify(e)));
      }
    }
    return pc;
  }


  static originalSync(showDetailedError = false): PrivateConfigClass & IConfigClass {
    const pc = ConfigClassBuilder.attachPrivateInterface(new PrivateConfigClass());
    ExtensionConfigTemplateLoader.Instance.loadExtensionTemplates(pc);
    try {
      pc.loadSync(); // loading the basic configs, but we do not know the extension config hierarchy yet

    } catch (e) {
      console.error(LOG_TAG, 'Error during loading config. Reverting to defaults.');
      console.error(e);
      if (showDetailedError) {
        console.error(LOG_TAG, 'This is most likely due to: 1) you added a bad configuration in the server.json OR 2) The configuration changed in the latest release.');
        NotificationManager.error('Ca\'nt load config. Reverting to default. This is most likely due to: 1) you added a bad configuration in the server.json OR 2) The configuration changed in the latest release.', (e.toString ? e.toString() : JSON.stringify(e)));
      }
    }
    return pc;
  }
}
