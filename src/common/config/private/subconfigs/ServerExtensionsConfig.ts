/* eslint-disable @typescript-eslint/no-inferrable-types */
import {ConfigMap, ConfigProperty, IConfigMap, SubConfigClass} from 'typeconfig/common';
import {ClientExtensionsConfig, ConfigPriority, TAGS} from '../../public/ClientConfig';
import {GenericConfigType} from 'typeconfig/src/GenericConfigType';

declare let $localize: (s: TemplateStringsArray) => string;

if (typeof $localize === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  global.$localize = (s) => s;
}

@SubConfigClass<TAGS>({softReadonly: true})
export class ServerExtensionsEntryConfig {

  constructor(path: string = '') {
    this.path = path;
  }

  @ConfigProperty({
    tags: {
      name: $localize`Enabled`,
      priority: ConfigPriority.advanced,
    },
  })
  enabled: boolean = true;

  @ConfigProperty({
    readonly: true,
    tags: {
      name: $localize`Extension folder`,
      priority: ConfigPriority.underTheHood,
    },
    description: $localize`Folder where the app stores all extensions. Individual extensions live in their own sub-folders.`,
  })
  path: string = '';

  @ConfigProperty({
    type: GenericConfigType,
    tags: {
      name: $localize`Config`,
      priority: ConfigPriority.advanced
    }
  })
  configs: GenericConfigType;
}

@SubConfigClass<TAGS>({softReadonly: true})
export class ServerExtensionsConfig extends ClientExtensionsConfig {

  @ConfigProperty({
    tags: {
      name: $localize`Extension folder`,
      priority: ConfigPriority.underTheHood,
      dockerSensitive: true
    },
    description: $localize`Folder where the app stores all extensions. Individual extensions live in their own sub-folders.`,
  })
  folder: string = 'extensions';

  @ConfigProperty({
    type: ConfigMap,
    tags: {
      name: $localize`Installed extensions`,
      priority: ConfigPriority.advanced
    }
  })
  extensions: IConfigMap<ServerExtensionsEntryConfig> = new ConfigMap();


  @ConfigProperty({
    tags: {
      name: $localize`Clean up unused tables`,
      priority: ConfigPriority.underTheHood,
    },
    description: $localize`Automatically removes all tables from the DB that are not used anymore.`,
  })
  cleanUpUnusedTables: boolean = true;
}
