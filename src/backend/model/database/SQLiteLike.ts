import {Config} from '../../../common/config/private/Config';
import {DatabaseType} from '../../../common/config/private/PrivateConfig';
import {SQL_COLLATE} from './enitites/EntityUtils';

/**
 * Text search that ignores case and accents on SQLite too, like MySQL's
 * utf8mb4_general_ci does: SQLite's LIKE only folds ASCII letters, so
 * searching "noel" did not find "Noël", nor "ÉTÉ" find "été" (#729).
 *
 * Only for the searches that need it (a JavaScript function called from
 * SQLite on every row costs about 5 times the native LIKE): pg_like()
 * compares both sides folded. The pattern is bound once: a query can have
 * thousands of conditions (SOME_OF) and SQLite limits the bound variables.
 */
export class SQLiteLike {
  private static readonly cache = new Map<string, RegExp>();
  // folded texts: the same folder name or keyword list comes for many photos
  private static readonly folded = new Map<string, string>();

  private static get sqlite(): boolean {
    return Config.Database.type === DatabaseType.sqlite;
  }

  /** Lower case, accents removed. */
  public static fold(text: string): string {
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7F]*$/.test(text)) {
      return text.toLowerCase();
    }
    let f = this.folded.get(text);
    if (f === undefined) {
      f = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      if (this.folded.size > 20000) {
        this.folded.clear();
      }
      this.folded.set(text, f);
    }
    return f;
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
    return `(${field} IS NOT NULL AND ${negate ? 'NOT ' : ''}pg_like(:${param}, ${field}${escArg}))`;
  }

  /** SQL LIKE semantics (with an optional ESCAPE character), case and accents folded. */
  public static like(pattern: string, value: unknown, escape?: string): number {
    if (pattern === null || value === null || value === undefined) {
      return null;
    }
    return this.toRegExp(String(pattern), escape).test(this.fold(String(value))) ? 1 : 0;
  }

  /** Adds pg_like() to a better-sqlite3 database. */
  public static register(db: { function: (name: string, options: object, fn: (...args: unknown[]) => unknown) => void }): void {
    db.function('pg_like', {deterministic: true, varargs: true}, (pattern: string, value: unknown, escape?: string) =>
      SQLiteLike.like(pattern, value, escape));
  }

  private static toRegExp(pattern: string, escape?: string): RegExp {
    const key = (escape ?? '') + '\u0000' + pattern;
    let re = this.cache.get(key);
    if (!re) {
      let src = '';
      const chars = [...this.fold(pattern)];
      const esc = escape ? this.fold(escape) : null;
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
