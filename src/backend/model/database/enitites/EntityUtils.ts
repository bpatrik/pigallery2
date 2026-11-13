import {Config} from '../../../../common/config/private/Config';
import {ColumnOptions} from 'typeorm/decorator/options/ColumnOptions';
import {DatabaseType} from '../../../../common/config/private/PrivateConfig';

export class ColumnCharsetCS implements ColumnOptions {
  public get charset(): string {
    return Config.Database.type === DatabaseType.mysql
        ? 'utf8mb4'
        : 'utf8';
  }

  public get collation(): string | undefined {
    return Config.Database.type === DatabaseType.mysql
        ? 'utf8mb4_bin'
        : undefined;
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

// fold() runs for every row of a search: folding char by char from a table is faster than normalizing every text
const NON_ASCII = /\P{ASCII}/u;
const NON_ASCII_ALL = /\P{ASCII}/gu;
const foldedChars = new Map<string, string>();
const foldChar = (char: string): string => {
  let folded = foldedChars.get(char);
  if (folded === undefined) {
    folded = char.normalize('NFD').replace(/\p{M}/gu, '');
    foldedChars.set(char, folded);
  }
  return folded;
};

/**
 * The text in lowercase and without accents: SQLite searches compare fold(column) LIKE fold(value),
 * as SQLite's LIKE ignores SQL_COLLATE (#1309). Registered as the SQL function fold() on SQLite.
 */
export const foldText = (text: string | null): string | null => {
  // most texts are ASCII: SQLite's LIKE ignores their case already
  if (text === null || !NON_ASCII.test(text)) {
    return text;
  }
  return text.toLowerCase().replace(NON_ASCII_ALL, foldChar);
};

