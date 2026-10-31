// Runs before every spec file. The specs run in jsdom, which has no layout and lacks some browser APIs.
// The stubs below only fill in what jsdom is missing; specs that care about the behaviour spy on them.

// Like Jasmine: spies made with vi.spyOn() are removed after each test.
// Tests that use vi.useFakeTimers() get the real timers back.
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Web Animations API: finishes right away
if (!Element.prototype.animate) {
  Element.prototype.animate = function(): Animation {
    const animation = new EventTarget() as Animation;
    animation.cancel = (): void => {
      // nothing is running
    };
    Object.defineProperty(animation, 'finished', {value: Promise.resolve(animation)});
    setTimeout(() => animation.dispatchEvent(new Event('finish')), 0);
    return animation;
  };
}

if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => {
    const list = new EventTarget() as MediaQueryList;
    Object.assign(list, {matches: false, media: query, onchange: null});
    return list;
  };
}

// Tests run on localhost, which browsers treat as a secure context
if (!('isSecureContext' in window)) {
  Object.defineProperty(window, 'isSecureContext', {get: (): boolean => true, configurable: true});
}

// The clipboard fallback for plain http
if (!document.execCommand) {
  document.execCommand = (): boolean => false;
}

if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: (): Promise<void> => Promise.resolve()},
    configurable: true
  });
}
