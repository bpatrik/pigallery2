import {Injectable, signal} from '@angular/core';


declare const document: {
  fullscreenElement: boolean;
  mozFullScreenElement: boolean;
  webkitFullscreenElement: boolean;
  exitFullscreen: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  mozCancelFullScreen: () => void;
  webkitExitFullscreen: () => void;
};

// the prefixed versions of Element.requestFullscreen
interface VendorFullscreenElement {
  mozRequestFullScreen?: () => void;
  webkitRequestFullscreen?: () => void;
  msRequestFullscreen?: () => void;
}

@Injectable({providedIn: 'root'})
export class FullScreenService {
  private readonly fullScreen = signal(this.isFullScreenEnabled());
  // follows the browser, also when the user leaves the full screen with Escape
  public readonly fullScreenEnabled = this.fullScreen.asReadonly();

  constructor() {
    for (const type of ['fullscreenchange', 'mozfullscreenchange', 'webkitfullscreenchange']) {
      document.addEventListener(type, (): void => this.fullScreen.set(this.isFullScreenEnabled()));
    }
  }

  public isFullScreenEnabled(): boolean {
    return !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement
    );
  }

  public showFullScreen(element: Element): void {
    if (this.isFullScreenEnabled()) {
      return;
    }

    const vendorElement = element as VendorFullscreenElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(console.error);
    } else if (vendorElement.mozRequestFullScreen) {
      vendorElement.mozRequestFullScreen();
    } else if (vendorElement.webkitRequestFullscreen) {
      vendorElement.webkitRequestFullscreen();
    } else if (vendorElement.msRequestFullscreen) {
      vendorElement.msRequestFullscreen();
    }
  }

  public exitFullScreen(): void {
    if (!this.isFullScreenEnabled()) {
      return;
    }

    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}
