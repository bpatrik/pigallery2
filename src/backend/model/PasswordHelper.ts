import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import {Logger} from '../Logger';

const LOG_TAG = '[PasswordHelper]';

export class PasswordHelper {
  private static readSecretFromEnvironment(varName: string, defaultValue: string,
                                           warnOnDefaultValue: boolean) : string {
    if (process.env[varName + '_FILE']) {
      var secretText = fs.readFileSync(process.env[varName + '_FILE'], 'utf-8');
      var secretLines = secretText.split(/\r?\n/).filter(i => i);
      if (secretLines.length !== 1) {
        throw new Error('The file pointed to by environment variable \'' + varName + '_FILE\'' +
          ' must have a single non-empty line');
      }
      return secretLines[0];
    } else if (process.env[varName]) {
      return process.env[varName];
    } else if (defaultValue) {
      if (warnOnDefaultValue) {
        Logger.warn(LOG_TAG, 'Environment variable \'' + varName + '\' not defined' +
          ', using default value \'' + defaultValue + '\'');
      }
      return defaultValue;
    } else {
      throw new Error('Environment variable \'' + varName + '\' must be defined');
    }
  }

  public static getDefaultAdminUser(): string {
    return PasswordHelper.readSecretFromEnvironment('PI_ADMIN_USER', 'admin', false);
  }

  public static getDefaultAdminPassword(): string {
    // TODO: remove defaults
    return PasswordHelper.readSecretFromEnvironment('PI_ADMIN_PASSWORD', 'admin', true);
  }

  public static cryptPassword(password: string): string {
    const salt = bcrypt.genSaltSync(9);
    return bcrypt.hashSync(password, salt);
  }

  public static comparePassword(password: string, encryptedPassword: string): boolean {
    try {
      return bcrypt.compareSync(password, encryptedPassword);
    } catch (e) {
    }
    return false;
  }
}
