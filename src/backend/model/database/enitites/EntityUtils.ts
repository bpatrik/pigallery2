import {Config} from '../../../../common/config/private/Config';
import {ColumnOptions} from 'typeorm/decorator/options/ColumnOptions';
import {DatabaseType} from '../../../../common/config/private/PrivateConfig';
import {foldChar} from '../../../../common/TextFold';

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
// the same keywords, persons and places come for many photos (idea from #1218)
const FOLDED_TEXTS_MAX = 20000;
const foldedTexts = new Map<string, string>();

/**
 * The text in lowercase and without accents: SQLite searches compare fold(column) LIKE fold(value),
 * as SQLite's LIKE ignores SQL_COLLATE (#1309). Registered as the SQL function fold() on SQLite.
 */
export const foldText = (text: string | null): string | null => {
  // most texts are ASCII: SQLite's LIKE ignores their case already
  if (text === null || !NON_ASCII.test(text)) {
    return text;
  }
  let folded = foldedTexts.get(text);
  if (folded === undefined) {
    folded = text.toLowerCase().replace(NON_ASCII_ALL, foldChar);
    if (foldedTexts.size >= FOLDED_TEXTS_MAX) {
      foldedTexts.clear();
    }
    foldedTexts.set(text, folded);
  }
  return folded;
};

