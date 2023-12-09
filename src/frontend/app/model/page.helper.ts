export class PageHelper {
  private static readonly supportPageOffset = window.pageXOffset !== undefined;
  private static readonly isCSS1Compat =
      (document.compatMode || '') === 'CSS1Compat';
  private static readonly body = document.getElementsByTagName('body')[0];


  public static get ScrollY(): number {
    return this.supportPageOffset
        ? window.pageYOffset
        : this.isCSS1Compat
            ? document.documentElement.scrollTop
            : document.body.scrollTop;
  }

  public static set ScrollY(value: number) {
    window.scrollTo(this.ScrollX, value);
  }

  public static get MaxScrollY(): number {
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

  public static get ScrollX(): number {
    return this.supportPageOffset
        ? window.pageXOffset
        : this.isCSS1Compat
            ? document.documentElement.scrollLeft
            : document.body.scrollLeft;
  }

  public static showScrollY(): void {
    PageHelper.body.style.overflowY = 'scroll';
  }

  public static isScrollYVisible(): boolean {
    return PageHelper.body.style.overflowY === 'scroll' ||
        (!PageHelper.body.style.overflowY && document.documentElement.scrollHeight > document.documentElement.clientHeight);
  }

  public static hideScrollY(): void {
    PageHelper.body.style.overflowY = 'hidden';
  }
}
