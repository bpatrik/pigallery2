import {TestBed} from '@angular/core/testing';
import {FullScreenService} from './fullscreen.service';

// #1310: the full screen button and the f key of the lightbox. jsdom has no Fullscreen API: the browser is faked here.
describe('FullScreenService', () => {
  let service: FullScreenService;
  let fullscreenElement: Element | null;
  let element: HTMLElement;
  let exitFullscreen: ReturnType<typeof vi.fn<() => Promise<void>>>;

  const fullScreenChange = (el: Element | null): void => {
    fullscreenElement = el;
    document.dispatchEvent(new Event('fullscreenchange'));
  };

  beforeEach(() => {
    fullscreenElement = null;
    Object.defineProperty(document, 'fullscreenElement', {configurable: true, get: () => fullscreenElement});
    exitFullscreen = vi.fn(() => {
      fullScreenChange(null);
      return Promise.resolve();
    });
    Object.defineProperty(document, 'exitFullscreen', {configurable: true, value: exitFullscreen});
    element = document.createElement('div');
    element.requestFullscreen = vi.fn(() => {
      fullScreenChange(element);
      return Promise.resolve();
    });
    service = TestBed.inject(FullScreenService);
  });

  afterEach(() => {
    delete (document as Partial<Record<'fullscreenElement' | 'exitFullscreen', unknown>>).fullscreenElement;
    delete (document as Partial<Record<'fullscreenElement' | 'exitFullscreen', unknown>>).exitFullscreen;
  });

  it('should start not in full screen', () => {
    expect(service.isFullScreenEnabled()).toBe(false);
    expect(service.fullScreenEnabled()).toBe(false);
  });

  it('should toggle the full screen on and off', () => {
    service.showFullScreen(element);
    expect(element.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(service.fullScreenEnabled()).toBe(true);

    service.exitFullScreen();
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(service.fullScreenEnabled()).toBe(false);
  });

  it('should not request the full screen twice', () => {
    service.showFullScreen(element);
    service.showFullScreen(element);
    expect(element.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('should not exit when not in full screen', () => {
    service.exitFullScreen();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('should follow the browser when the user leaves the full screen with Escape', () => {
    service.showFullScreen(element);
    // the browser leaves the full screen by itself
    fullScreenChange(null);
    expect(service.fullScreenEnabled()).toBe(false);
  });

  it('should use the prefixed API of older browsers', () => {
    const webkitElement = document.createElement('div') as HTMLElement & { webkitRequestFullscreen?: () => void };
    Object.defineProperty(webkitElement, 'requestFullscreen', {value: undefined});
    webkitElement.webkitRequestFullscreen = vi.fn();
    service.showFullScreen(webkitElement);
    expect(webkitElement.webkitRequestFullscreen).toHaveBeenCalledTimes(1);
  });
});
