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

/**
 * Same as columnCharsetCS, but with extra column options.
 * charset and collation stay lazy getters, so they are resolved when the DB connection
 * is built and not when the entity file is imported (Config.Database.type might change in between).
 */
export const columnCharsetCSWith = (options: ColumnOptions): ColumnOptions =>
  Object.assign(new ColumnCharsetCS(), options);
export const SQL_COLLATE = 'utf8mb4_general_ci';
