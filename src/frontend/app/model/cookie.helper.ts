export class CookieHelper {

  // Returns null if the cookie is not set or not readable from JS (httpOnly).
  static get(name: string): string | null {
    const prefix = encodeURIComponent(name) + '=';
    const cookie = document.cookie.split('; ').find((c) => c.startsWith(prefix));
    if (cookie === undefined) {
      return null;
    }
    const value = cookie.substring(prefix.length);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  static set(name: string, value: string, expiresInDays: number): void {
    const expires = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) +
      ';expires=' + expires + ';SameSite=Lax';
  }
}
