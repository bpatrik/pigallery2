import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import {Event as RouterEvent, NavigationEnd, NavigationStart, Router} from '@angular/router';
import {ScrollRestorationService} from './scroll-restoration.service';

// #1308, #1310: browser back and forward restore the scroll position of a page, also once its content renders later
describe('ScrollRestorationService', () => {
  let service: ScrollRestorationService;
  let events: Subject<RouterEvent>;
  let originalRestoration: ScrollRestoration;
  let nextId = 1;

  beforeEach(() => {
    originalRestoration = history.scrollRestoration;
    events = new Subject<RouterEvent>();
    nextId = 1;
    TestBed.configureTestingModule({
      providers: [{provide: Router, useValue: {events}}]
    });
    service = TestBed.inject(ScrollRestorationService);
  });

  afterEach(() => {
    history.scrollRestoration = originalRestoration;
    vi.restoreAllMocks();
  });

  const scrolledTo = (y: number): void => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(y);
  };

  /** A navigation; returns its id, that the browser saves in the state of its history entry. */
  const navigate = (url: string, restoredNavigationId?: number): number => {
    const id = nextId++;
    events.next(new NavigationStart(id, url, restoredNavigationId === undefined ? 'imperative' : 'popstate',
      restoredNavigationId === undefined ? null : {navigationId: restoredNavigationId}));
    events.next(new NavigationEnd(id, url, url));
    return id;
  };

  it('should take over the scroll restoration from the browser', () => {
    expect(history.scrollRestoration).toBe('manual');
  });

  it('should give the scroll position of the folder when going back to it', () => {
    const root = navigate('/gallery/');
    scrolledTo(1500);
    navigate('/gallery/Holiday%202024');
    scrolledTo(0);
    navigate('/gallery/', root);

    expect(service.restoreTarget()).toBe(1500);
    // also for a later render of the page (e.g. once the folder replaced the previous search)
    expect(service.restoreTarget()).toBe(1500);
  });

  it('should stop restoring once the user scrolls, taps or types', () => {
    for (const input of [new WheelEvent('wheel'), new Event('touchstart'), new KeyboardEvent('keydown'), new Event('pointerdown')]) {
      const root = navigate('/gallery/');
      scrolledTo(1500);
      navigate('/gallery/sub');
      navigate('/gallery/', root);
      expect(service.restoreTarget()).toBe(1500);

      window.dispatchEvent(input);
      expect(service.restoreTarget(), input.type).toBeNull();
    }
  });

  it('should give the scroll position when going forward', () => {
    navigate('/gallery/');
    const sub = navigate('/gallery/Árvíztűrő');
    scrolledTo(700);
    const root = navigate('/gallery/');
    scrolledTo(1500);
    navigate('/gallery/Árvíztűrő', sub);
    navigate('/gallery/', root);

    expect(service.restoreTarget()).toBe(1500);
  });

  it('should go to the top of a page that it does not know', () => {
    navigate('/gallery/');
    scrolledTo(1500);
    navigate('/gallery/sub', 1234);

    expect(service.restoreTarget()).toBe(0);
  });

  // the lightbox (?p=) scrolls the grid to its last photo itself
  it('should not restore when only the query params change', () => {
    const grid = navigate('/gallery/');
    scrolledTo(200);
    navigate('/gallery/?p=IMG_5910.jpg');
    scrolledTo(1800);
    navigate('/gallery/', grid);

    expect(service.restoreTarget()).toBeNull();
  });

  it('should not restore after a link or a button navigation', () => {
    navigate('/gallery/');
    scrolledTo(1500);
    navigate('/gallery/sub');

    expect(service.restoreTarget()).toBeNull();
  });

  it('should not give the position before the navigation ended', () => {
    const root = navigate('/gallery/');
    scrolledTo(1500);
    navigate('/gallery/sub');
    events.next(new NavigationStart(nextId++, '/gallery/', 'popstate', {navigationId: root}));

    expect(service.restoreTarget()).toBeNull();
  });
});
