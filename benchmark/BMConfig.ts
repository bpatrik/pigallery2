/* eslint-disable @typescript-eslint/no-inferrable-types */
import * as path from 'node:path';
import * as os from 'node:os';
import { ConfigClass, ConfigClassBuilder } from 'typeconfig/node';
import { ConfigProperty, SubConfigClass } from 'typeconfig/common';

@SubConfigClass({softReadonly: true})
export class BenchmarksConfig {
  @ConfigProperty()
  bmScanDirectory: boolean = true;
  @ConfigProperty()
  bmSaveDirectory: boolean = true;
  @ConfigProperty()
  bmListDirectory: boolean = true;
  @ConfigProperty()
  bmListPersons: boolean = true;
  @ConfigProperty()
  bmAllSearch: boolean = true;
  @ConfigProperty()
  bmAutocomplete: boolean = true;
}

@ConfigClass({
  configPath: path.join(__dirname, './../bm_config.json'),
  saveIfNotExist: true,
  attachDescription: true,
  enumsAsString: true,
  softReadonly: true,
  cli: {
    prefix: 'bm-config',
    enable: {
      configPath: true,
      attachState: true,
      attachDescription: true,
      rewriteCLIConfig: true,
      rewriteENVConfig: true,
      enumsAsString: true,
      saveIfNotExist: true,
      exitOnConfig: true,
    },
    defaults: {
      enabled: true,
    },
  },
})
export class PrivateConfigClass {
  @ConfigProperty({
    description:
      'Images are loaded from this folder (read permission required)',
  })
  path: string = '/app/data/images';
  @ConfigProperty({
    description: 'The benchmark keeps its DB and temp files here. The DB folder is deleted between runs, so it never uses the app DB folder.',
  })
  tempFolder: string = path.join(os.tmpdir(), 'pigallery2-benchmark');
  @ConfigProperty({ description: 'Describe your system setup' })
  system: string = '';
  @ConfigProperty({ description: 'Number of times to run the benchmark' })
  RUNS: number = 50;
  @ConfigProperty({ description: 'Enables / disables benchmarks' })
  Benchmarks: BenchmarksConfig = new BenchmarksConfig();
}

export const BMConfig = ConfigClassBuilder.attachInterface(
  new PrivateConfigClass()
);
BMConfig.loadSync();
