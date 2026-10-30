import {Config} from '../../../common/config/private/Config';
import {DatabaseType} from '../../../common/config/private/PrivateConfig';
import {SQL_COLLATE} from './enitites/EntityUtils';
import {TextFold} from '../../../common/TextFold';

/**
 * Text search that ignores case and accents on SQLite too, like MySQL's
 * utf8mb4_general_ci does: SQLite's LIKE only folds ASCII letters, so
 * searching "noel" did not find "Noël", nor "ÉTÉ" find "été" (#729).
 *
 * Only for the searches that need it: fold_like() compares both sides
 * folded. It is a JavaScript function that SQLite calls on every row, about
 * 5 times the cost of the native LIKE (folded texts and patterns are cached).
 * That includes the projection of directory allow / block lists with
 * wildcards (SessionManager), and every search typed in the search box:
 * measured on a 26k photo gallery, 18 ms -> about 80 ms for an any_text
 * search. The pattern is bound once: a query can have thousands of
 * conditions (SOME_OF) and SQLite limits the bound variables.
 *
 * Exact matches (e.g. person:"janos", or albums and saved searches built
 * from them) keep the native LIKE, so on SQLite they still tell accents
 * apart while MySQL does not.
 */
export class SQLiteLike {
  private static readonly cache = new Map<string, RegExp>();

  private static get sqlite(): boolean {
    return Config.Database.type === DatabaseType.sqlite;
  }

  /** Lower case, accents removed (see TextFold for the letters it keeps). */
  public static fold(text: string): string {
    return TextFold.fold(text);
  }

  /** The LIKE pattern to bind for where(). */
  public static param(pattern: string): string {
    return this.sqlite ? this.fold(pattern) : pattern;
  }

  /**
   * WHERE condition: `field` LIKE (or NOT LIKE) the pattern bound as `param`
   * (made with param()), ignoring case and accents.
   * @param escape the pattern escapes with '\'
   */
  public static where(field: string, param: string, escape = false, negate = false): string {
    if (!this.sqlite) {
      return `${field} ${negate ? 'NOT LIKE' : 'LIKE'} :${param} COLLATE ${SQL_COLLATE}`;
    }
    const escArg = escape ? ', \'\\\'' : '';
    return `(${field} IS NOT NULL AND ${negate ? 'NOT ' : ''}fold_like(:${param}, ${field}${escArg}))`;
  }

  /**
   * SQL LIKE semantics (with an optional ESCAPE character), case and accents
   * folded. The pattern is already folded by param().
   */
  public static like(pattern: string, value: unknown, escape?: string): number {
    if (pattern === null || value === null || value === undefined) {
      return null;
    }
    return this.toRegExp(String(pattern), escape).test(this.fold(String(value))) ? 1 : 0;
  }

  /** Adds fold_like() to a better-sqlite3 database. */
  public static register(db: { function: (name: string, options: object, fn: (...args: unknown[]) => unknown) => void }): void {
    db.function('fold_like', {deterministic: true, varargs: true}, (pattern: string, value: unknown, escape?: string) =>
      SQLiteLike.like(pattern, value, escape));
  }

  private static toRegExp(pattern: string, escape?: string): RegExp {
    const key = (escape ?? '') + '\u0000' + pattern;
    let re = this.cache.get(key);
    if (!re) {
      let src = '';
      const chars = [...pattern];
      const esc = escape || null;
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (esc && c === esc && i + 1 < chars.length) {
          src += chars[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        } else if (c === '%') {
          src += '.*';
        } else if (c === '_') {
          src += '.';
        } else {
          src += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
      }
      re = new RegExp('^' + src + '$', 'su');
      if (this.cache.size > 200) {
        this.cache.clear();
      }
      this.cache.set(key, re);
    }
    return re;
  }
}
