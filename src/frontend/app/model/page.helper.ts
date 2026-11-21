export class PageHelper {
  private static readonly body = document.getElementsByTagName('body')[0];
  private static readonly supportPageOffset = window.pageXOffset !== undefined;
  private static readonly isCSS1Compat =
    (document.compatMode || '') === 'CSS1Compat';
  private static scrollLocks: Record<string, boolean> = {};

  public static get ScrollY(): number {
    // use the standard way to get Window scroll if available
    if (window.scrollY !== undefined) {
      return window.scrollY;
    }
    return this.supportPageOffset
      ? window.pageYOffset
      : this.isCSS1Compat
        ? document.documentElement.scrollTop
        : document.body.scrollTop;
  }

  public static set ScrollY(value: number) {
    window.scrollTo(this.ScrollX, value);
  }

  public static get OverflowY(): string {
    return PageHelper.body.style.overflowY;
  }

  public static set OverflowY(value: string) {
    PageHelper.body.style.overflowY = value;
  }

  public static get MaxScrollY(): number {
    // Detect if there is no visible scrollbar, so nothing to scroll
    if (document.documentElement.scrollHeight <= document.documentElement.clientHeight) {
      return 0;
    }
    return (
      Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      ) - window.innerHeight
    );
  }

  /** The bottom of the navbar on the screen; 0 if the navbar is hidden. */
  public static get NavbarBottom(): number {
    const navbar = document.querySelector('.navbar-container');
    return navbar ? Math.max(0, navbar.getBoundingClientRect().bottom) : 0;
  }

  public static get ScrollX(): number {
    return this.supportPageOffset
      ? window.pageXOffset
      : this.isCSS1Compat
        ? document.documentElement.scrollLeft
        : document.body.scrollLeft;
  }

  public static showScrollY(requester: string): void {
    delete this.scrollLocks[requester];
    if(Object.values(this.scrollLocks).length > 0) return;
    PageHelper.body.style.overflowY = 'scroll';
  }

  public static isScrollYVisible(): boolean {
    return PageHelper.body.style.overflowY === 'scroll' ||
      (!PageHelper.body.style.overflowY && document.documentElement.scrollHeight > document.documentElement.clientHeight);
  }

  public static hideScrollY(requester: string): void {
    this.scrollLocks[requester] = true;
    PageHelper.body.style.overflowY = 'hidden';
  }
}
