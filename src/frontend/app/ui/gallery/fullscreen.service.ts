import {Injectable} from '@angular/core';
import {Event} from '../../../../common/event/Event';


declare const document: {
  fullscreenElement: boolean;
  mozFullScreenElement: boolean;
  webkitFullscreenElement: boolean;
  exitFullscreen: () => void;
  mozCancelFullScreen: () => void;
  webkitExitFullscreen: () => void;
};

@Injectable()
export class FullScreenService {
  OnFullScreenChange = new Event<boolean>();

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

    if (element.requestFullscreen) {
      element.requestFullscreen().catch(console.error);
    } else if ((element as unknown as Record<string, () => void>).mozRequestFullScreen) {
      (element as unknown as Record<string, () => void>).mozRequestFullScreen();
    } else if ((element as unknown as Record<string, () => void>).webkitRequestFullscreen) {
      (element as unknown as Record<string, () => void>).webkitRequestFullscreen();
    } else if ((element as unknown as Record<string, () => void>).msRequestFullscreen) {
      (element as unknown as Record<string, () => void>).msRequestFullscreen();
    }
    this.OnFullScreenChange.trigger(true);
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
    this.OnFullScreenChange.trigger(false);
  }
}
