import {Injectable} from '@angular/core';
import {Event} from '../../../../common/event/Event';
import {PageHelper} from '../../model/page.helper';

@Injectable()
export class OverlayService {
  OnOverlayChange = new Event<boolean>();
  private scrollWidth: number = null;

  public showOverlay(): void {
    // disable scrolling
    PageHelper.hideScrollY();
    this.OnOverlayChange.trigger(true);
  }

  public hideOverlay(): void {
    PageHelper.showScrollY();
    this.OnOverlayChange.trigger(false);
  }

  getScrollbarWidth(): number {
    if (this.scrollWidth == null) {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.width = '100px';
      (outer.style as unknown as Record<string, string>).msOverflowStyle = 'scrollbar'; // needed for WinJS apps

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
      outer.parentNode.removeChild(outer);
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
