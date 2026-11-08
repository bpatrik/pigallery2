/* eslint-disable @typescript-eslint/no-inferrable-types */
import {ConfigMap, ConfigProperty, GenericConfigType, SubConfigClass} from 'typeconfig/common';
import {ClientExtensionsConfig, ConfigPriority, TAGS} from '../../public/ClientConfig';

declare let $localize: (s: TemplateStringsArray) => string;

if (typeof $localize === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  global.$localize = (s: TemplateStringsArray) => s;
}

@SubConfigClass<TAGS>({softReadonly: true})
export class ServerExtensionsEntryConfig {

  constructor(path: string = '') {
    this.path = path;
  }

  @ConfigProperty({
    type: 'boolean',
    tags: {
      name: $localize`Enabled`,
      priority: ConfigPriority.advanced,
    },
  })
  enabled: boolean = true;

  @ConfigProperty({
    type: 'string',
    readonly: true,
    tags: {
      name: $localize`Extension folder`,
      priority: ConfigPriority.underTheHood,
    },
    description: $localize`Sub-folder of the given extension.`,
  })
  path: string = '';

  @ConfigProperty({
    type: GenericConfigType,
    tags: {
      name: $localize`Config`,
      priority: ConfigPriority.advanced
    }
  })
  configs!: GenericConfigType; // loaded from the config or set by the extension
}

@SubConfigClass<TAGS>({softReadonly: true})
export class ServerExtensionsConfig extends ClientExtensionsConfig {

  @ConfigProperty({
    type: 'string',
    tags: {
      name: $localize`Repository url`,
      priority: ConfigPriority.underTheHood
    },
    description: $localize`Repository url that points to a list of extensions in .md format.`,
  })
  repositoryUrl: string = 'https://raw.githubusercontent.com/bpatrik/pigallery2/master/extension/REPOSITORY.md';

  @ConfigProperty({
    type: 'string',
    tags: {
      name: $localize`Extension folder`,
      priority: ConfigPriority.underTheHood,
      dockerSensitive: true,
      uiResetNeeded: {server: true},
    },
    description: $localize`Folder where the app stores all extensions. Individual extensions live in their own sub-folders.`,
  })
  folder: string = 'extensions';

  @ConfigProperty({
    type: ConfigMap,
    tags: {
      name: $localize`Installed extensions`,
      uiIcon: 'ionList',
      priority: ConfigPriority.advanced
    }
  })
  extensions = new ConfigMap<ServerExtensionsEntryConfig>();


  @ConfigProperty({
    type: 'boolean',
    tags: {
      name: $localize`Clean up unused tables`,
      priority: ConfigPriority.underTheHood,
    },
    description: $localize`Automatically removes all tables from the DB that are not used anymore.`,
  })
  cleanUpUnusedTables: boolean = true;
}
