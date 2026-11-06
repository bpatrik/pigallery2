/**
 * Lower case without accents ("Noël" -> "noel"), to compare texts like
 * MySQL's utf8mb4_general_ci does (#729). Shared by the SQLite search
 * (SQLiteLike) and the directory allow / block lists (SearchQueryUtils).
 *
 * NFD only splits letters that carry a combining mark: Ł, ø, ß, æ or đ have
 * none and stay as they are, so "lodz" does not find "Łódź" (general_ci does
 * not fold all of these either).
 */
export class TextFold {
  // the same folder name or keyword list comes for many photos
  private static readonly cache = new Map<string, string>();

  public static fold(text: string): string {
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7F]*$/.test(text)) {
      return text.toLowerCase();
    }
    let f = this.cache.get(text);
    if (f === undefined) {
      f = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      if (this.cache.size > 20000) {
        this.cache.clear();
      }
      this.cache.set(text, f);
    }
    return f;
  }
}
