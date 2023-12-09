import {Config} from '../../../../common/config/private/Config';
import {ColumnOptions} from 'typeorm/decorator/options/ColumnOptions';
import {DatabaseType} from '../../../../common/config/private/PrivateConfig';

export class ColumnCharsetCS implements ColumnOptions {
  public get charset(): string {
    return Config.Database.type === DatabaseType.mysql
        ? 'utf8mb4'
        : 'utf8';
  }

  public get collation(): string {
    return Config.Database.type === DatabaseType.mysql
        ? 'utf8mb4_bin'
        : null;
  }
}

export const columnCharsetCS = new ColumnCharsetCS();
export const SQL_COLLATE = 'utf8mb4_general_ci';
