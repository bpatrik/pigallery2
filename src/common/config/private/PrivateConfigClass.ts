import {ServerConfig} from './PrivateConfig';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import {ConfigClass} from 'typeconfig/node';
import {IConfigClass} from 'typeconfig/common';
import {PasswordHelper} from '../../../backend/model/PasswordHelper';
import {ClientConfig, TAGS} from '../public/ClientConfig';

const upTime = new Date().toISOString();
// TODO: Refactor Config to be injectable globally.
// This is a bad habit to let the Config know if its in a testing env.
const isTesting = process.env['NODE_ENV'] === '1' || ['afterEach', 'after', 'beforeEach', 'before', 'describe', 'it']
  .every((fn) => (globalThis as Record<string, unknown>)[fn] instanceof Function);
if (isTesting) {
  console.log('Running Config in testing mode');
}

@ConfigClass<IConfigClass<TAGS> & ServerConfig>({
  configPath: path.join(__dirname, !isTesting ? './../../../../config.json' : './../../../../test/tmp/config.json'),
  crateConfigPathIfNotExists: isTesting,
  saveIfNotExist: true,
  attachDescription: true,
  enumsAsString: true,
  softReadonly: true,
  cli: {
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
  onLoadedSync: (config) => {
    let changed = false;
    for (let i = 0; i < config.Users.enforcedUsers.length; ++i) {
      const uc = config.Users.enforcedUsers[i];

      // encrypt password and save back to the config
      if (uc.password) {
        if (!uc.encryptedPassword) {
          uc.encryptedPassword = PasswordHelper.cryptPassword(uc.password);
        }
        uc.password = '';
        changed = true;
      }
      if (!uc.encrypted) {
        uc.encrypted = !!uc.encryptedPassword;
        changed = true;
      }
      if (!uc.encrypted && !uc.password) {
        throw new Error('Password error for enforced user: ' + uc.name);
      }
    }
    if (changed) {
      config.saveSync();
    }
  }
})
export class PrivateConfigClass extends ServerConfig {

  constructor() {
    super();
    if (!this.Server.sessionSecret || this.Server.sessionSecret.length === 0) {
      this.Server.sessionSecret = [
        crypto.randomBytes(256).toString('hex'),
        crypto.randomBytes(256).toString('hex'),
        crypto.randomBytes(256).toString('hex'),
      ];
    }

    const pkg = require('../../../../package.json') as { version?: string, buildTime?: string, buildCommitHash?: string };
    this.Environment.appVersion = pkg.version;
    this.Environment.buildTime = pkg.buildTime;
    this.Environment.buildCommitHash = pkg.buildCommitHash;
    this.Environment.upTime = upTime;
    this.Environment.isDocker = !!process.env['PI_DOCKER'];
  }

  getClientConfig() {
    return (this as unknown as IConfigClass<TAGS>).toJSON({
      attachVolatile: true,
      skipTags: {secret: true},
      keepTags: {client: true}
    }) as unknown as ClientConfig;
  }


}
