import {PrivateConfigClass} from '../../../common/config/private/PrivateConfigClass';
import * as fs from 'fs';
import * as path from 'path';
import {ServerExtensionsEntryConfig} from '../../../common/config/private/subconfigs/ServerExtensionsConfig';
import {ProjectPath} from '../../ProjectPath';
import {Utils} from '../../../common/Utils';


/**
 * This class decouples the extension management and the config.
 * It helps to solve the "chicken and the egg" which should load first:
 *  Config or the extension as they have a circular dependency
 */
export class ExtensionConfigTemplateLoader {

  private static instance: ExtensionConfigTemplateLoader;

  private extensionList: string[] = [];
  private extensionTemplates: { folder: string, template?: new() => unknown }[] = [];

  public static get Instance() {
    if (!this.instance) {
      this.instance = new ExtensionConfigTemplateLoader();
    }

    return this.instance;
  }

  /**
   * Loads a single extension template and adds it to the config
   * @param extFolder The folder name of the extension
   * @param config The config object to add the extension template to
   */
  public loadSingleExtension(extFolder: string, config: PrivateConfigClass) {
    if (!ProjectPath.ExtensionFolder) {
      throw new Error('Unknown extensions folder.');
    }

    const extPath = path.join(ProjectPath.ExtensionFolder, extFolder);
    if (!fs.existsSync(extPath) || !fs.statSync(extPath).isDirectory()) {
      throw new Error(`Extension folder ${extFolder} does not exist.`);
    }

    const template = this.loadSingleExtensionTemplate(extFolder);
    if (template) {
      // Check if the extension is already loaded
      const existingIndex = this.extensionTemplates.findIndex(et => et.folder === extFolder);
      if (existingIndex >= 0) {
        // Replace the existing template
        this.extensionTemplates[existingIndex] = template;
      } else {
        // Add the new template
        this.extensionTemplates.push(template);
      }

      this.setTemplatesToConfig(config);
    }
  }

  public loadExtensionTemplates(config: PrivateConfigClass) {
    if (!ProjectPath.ExtensionFolder) {
      throw new Error('Unknown extensions folder.');
    }

    if (!fs.existsSync(ProjectPath.ExtensionFolder)) {
      return;
    }


    const newList = this.getExtensionFolders();
    const loaded = Utils.equalsFilter(this.extensionList, newList);
    this.extensionList = newList;
    // already loaded
    if (!loaded) {
      this.extensionTemplates = [];

      for (let i = 0; i < this.extensionList.length; ++i) {
        const extFolder = this.extensionList[i];
        const template = this.loadSingleExtensionTemplate(extFolder);
        if (template) {
          this.extensionTemplates.push(template);
        }
      }
    }

    this.setTemplatesToConfig(config);
  }

  /**
   * Loads a single extension template
   * @param extFolder The folder name of the extension
   * @returns The extension template object if the extension is valid, null otherwise
   */
  private loadSingleExtensionTemplate(extFolder: string): { folder: string, template?: new() => unknown } | null {
    if (!ProjectPath.ExtensionFolder) {
      throw new Error('Unknown extensions folder.');
    }

    const extPath = path.join(ProjectPath.ExtensionFolder, extFolder);
    const configExtPath = path.join(extPath, 'config.js');
    const serverExtPath = path.join(extPath, 'server.js');

    // if server.js is missing, it's not a valid extension
    if (!fs.existsSync(serverExtPath)) {
      return null;
    }

    let template: { folder: string, template?: new() => unknown } = {folder: extFolder};

    if (fs.existsSync(configExtPath)) {
      const extCfg = require(configExtPath);
      if (typeof extCfg?.initConfig === 'function') {
        extCfg?.initConfig({
          setConfigTemplate: (templateClass: new() => unknown): void => {
            template = {folder: extFolder, template: templateClass};
          }
        });
      }
    }

    return template;
  }

  private getExtensionFolders() {
    const list = (fs
      .readdirSync(ProjectPath.ExtensionFolder))
      .filter((f): boolean =>
        fs.statSync(path.join(ProjectPath.ExtensionFolder, f)).isDirectory()
      );
    list.sort();
    return list;
  }

  private setTemplatesToConfig(config: PrivateConfigClass) {
    if (!this.extensionTemplates) {
      return;
    }

    const ePaths = this.extensionTemplates.map(et => et.folder);

    // delete not existing extensions
    for (const prop of config.Extensions.extensions.keys()) {
      if (ePaths.indexOf(prop) > -1) {
        continue;
      }
      config.Extensions.extensions.removeProperty(prop);
    }


    for (let i = 0; i < this.extensionTemplates.length; ++i) {
      const ext = this.extensionTemplates[i];

      let c = config.Extensions.extensions[ext.folder];

      // set the new structure with the new def values
      if (!c) {
        c = new ServerExtensionsEntryConfig(ext.folder);
        if (ext.template) {
          c.configs = new ext.template();
        }
        config.Extensions.extensions.addProperty(ext.folder, {type: ServerExtensionsEntryConfig}, c);
      }

    }
  }
}
