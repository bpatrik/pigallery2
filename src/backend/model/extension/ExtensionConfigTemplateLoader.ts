import {PrivateConfigClass} from '../../../common/config/private/PrivateConfigClass';
import * as fs from 'fs';
import * as path from 'path';
import {ServerExtensionsEntryConfig} from '../../../common/config/private/subconfigs/ServerExtensionsConfig';
import * as child_process from 'child_process';

const execSync = child_process.execSync;

const LOG_TAG = '[ExtensionConfigTemplateLoader]';

/**
 * This class decouples the extension management and the config.
 * It helps to solve the "chicken and the egg" which should load first:
 *  Config or the extension as they have a circular dependency
 */
export class ExtensionConfigTemplateLoader {

  private static instance: ExtensionConfigTemplateLoader;
  private extensionsFolder: string;

  private loaded = false;
  private extensionList: string[] = [];
  private extensionTemplates: { folder: string, template?: { new(): unknown } }[] = [];

  public static get Instance() {
    if (!this.instance) {
      this.instance = new ExtensionConfigTemplateLoader();
    }

    return this.instance;
  }


  init(extensionsFolder: string) {
    this.extensionsFolder = extensionsFolder;
  }

  public loadExtensionTemplates(config: PrivateConfigClass) {
    if (!this.extensionsFolder) {
      throw new Error('Unknown extensions folder.');
    }
    // already loaded
    if (!this.loaded) {

      this.extensionTemplates = [];
      if (fs.existsSync(this.extensionsFolder)) {
        this.extensionList = (fs
          .readdirSync(this.extensionsFolder))
          .filter((f): boolean =>
            fs.statSync(path.join(this.extensionsFolder, f)).isDirectory()
          );
        this.extensionList.sort();

        for (let i = 0; i < this.extensionList.length; ++i) {
          const extFolder = this.extensionList[i];
          const extPath = path.join(this.extensionsFolder, extFolder);
          const configExtPath = path.join(extPath, 'config.js');
          const serverExtPath = path.join(extPath, 'server.js');

          // if server.js is missing, it's not a valid extension
          if (!fs.existsSync(serverExtPath)) {
            continue;
          }


          if (fs.existsSync(configExtPath)) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const extCfg = require(configExtPath);
            if (typeof extCfg?.initConfig === 'function') {
              extCfg?.initConfig({
                setConfigTemplate: (template: { new(): unknown }): void => {
                  this.extensionTemplates.push({folder: extFolder, template: template});
                }
              });
            }
          } else {
            //also create basic config extensions that do not have any
            this.extensionTemplates.push({folder: extFolder});
          }
        }
      }
      this.loaded = true;
    }

    this.setTemplatesToConfig(config);
  }


  private setTemplatesToConfig(config: PrivateConfigClass) {
    if (!this.extensionTemplates) {
      return;
    }

    const ePaths = this.extensionTemplates.map(et => et.folder);
    // delete not existing extensions
    config.Extensions.extensions = config.Extensions.extensions
      .filter(ec => ePaths.indexOf(ec.path) !== -1);


    for (let i = 0; i < this.extensionTemplates.length; ++i) {
      const ext = this.extensionTemplates[i];

      let c = (config.Extensions.extensions || [])
        .find(e => e.path === ext.folder);

      // set the new structure with the new def values
      if (!c) {
        c = new ServerExtensionsEntryConfig(ext.folder);
        if (ext.template) {
          c.configs = new ext.template();
        }
        // TODO: this does not hold if the order of the extensions mixes up.
        // TODO: experiment with a map instead of an array
        config.Extensions.extensions.push(c);
      }

    }
  }
}
