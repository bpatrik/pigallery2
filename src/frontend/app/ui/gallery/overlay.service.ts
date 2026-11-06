import {Injectable} from '@angular/core';
import {PageHelper} from '../../model/page.helper';

@Injectable({providedIn: 'root'})
export class OverlayService {
  private scrollWidth: number | null = null;

  public showOverlay(requester:string): void {
    // disable scrolling
    PageHelper.hideScrollY(requester);
  }

  public hideOverlay(requester:string): void {
    PageHelper.showScrollY(requester);
  }

  getScrollbarWidth(): number {
    if (this.scrollWidth == null) {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.width = '100px';
      (outer.style as CSSStyleDeclaration & { msOverflowStyle: string }).msOverflowStyle = 'scrollbar'; // needed for WinJS apps

      document.body.appendChild(outer);

      const widthNoScroll = outer.offsetWidth;
      // force scrollbars
      outer.style.overflowY = 'scroll';

      // add innerdiv
      const inner = document.createElement('div');
      inner.style.width = '100%';
      outer.appendChild(inner);

      const widthWithScroll = inner.offsetWidth;

      // remove divs
      outer.parentNode?.removeChild(outer);
      this.scrollWidth = widthNoScroll - widthWithScroll;
    }

    return this.scrollWidth;
  }

  getPhantomScrollbarWidth(): number {
    if (!PageHelper.isScrollYVisible()) {
      return this.getScrollbarWidth();
    }
    return 0;
  }
}
