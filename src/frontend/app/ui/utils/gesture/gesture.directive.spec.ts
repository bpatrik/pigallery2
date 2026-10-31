import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {GestureDirective, PanEvent, PinchEvent} from './gesture.directive';

@Component({
  template: `
    <div appGesture
         (swipeLeft)="events.push('swipeLeft')"
         (swipeRight)="events.push('swipeRight')"
         (swipeUp)="events.push('swipeUp')"
         (doubleTap)="events.push('doubleTap')"
         (pan)="pans.push($event)"
         (pinch)="pinches.push($event)"></div>`,
  imports: [GestureDirective]
})
class HostComponent {
  events: string[] = [];
  pans: PanEvent[] = [];
  pinches: PinchEvent[] = [];
}

describe('GestureDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;
  let time: number;

  // timeStamp can't be set on synthetic events, so the clock is faked
  const pointer = (type: string, id: number, x: number, y: number, target: EventTarget = window): void => {
    const e = new PointerEvent(type, {pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true});
    Object.defineProperty(e, 'timeStamp', {value: time});
    target.dispatchEvent(e);
  };
  const down = (id: number, x: number, y: number): void => pointer('pointerdown', id, x, y, element);
  const move = (id: number, x: number, y: number): void => pointer('pointermove', id, x, y);
  const up = (id: number, x: number, y: number): void => pointer('pointerup', id, x, y);

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    element = fixture.nativeElement.querySelector('div');
    time = 1000;
  });

  it('should swipe left, right and up on a fast move', () => {
    for (const [dx, dy] of [[-100, 0], [100, 0], [0, -100]]) {
      down(1, 200, 200);
      time += 100;
      move(1, 200 + dx, 200 + dy);
      up(1, 200 + dx, 200 + dy);
      time += 1000;
    }
    expect(host.events).toEqual(['swipeLeft', 'swipeRight', 'swipeUp']);
  });

  it('should not swipe on a slow move or a swipe down', () => {
    down(1, 200, 200);
    time += 1000;
    up(1, 100, 200);
    time += 1000;
    down(1, 200, 200);
    time += 100;
    up(1, 200, 300);
    expect(host.events).toEqual([]);
  });

  it('should pan relative to the start and end with isFinal', () => {
    down(1, 100, 100);
    move(1, 110, 90);
    time += 1000;
    up(1, 120, 80);
    expect(host.pans).toEqual([
      {deltaX: 10, deltaY: -10, isFinal: false},
      {deltaX: 20, deltaY: -20, isFinal: true}
    ]);
  });

  it('should double tap on two quick taps at the same place', () => {
    down(1, 100, 100);
    time += 50;
    up(1, 100, 100);
    time += 100;
    down(1, 102, 101);
    time += 50;
    up(1, 102, 101);
    expect(host.events).toEqual(['doubleTap']);
  });

  it('should not double tap on two slow taps', () => {
    down(1, 100, 100);
    time += 50;
    up(1, 100, 100);
    time += 500;
    down(1, 100, 100);
    time += 50;
    up(1, 100, 100);
    expect(host.events).toEqual([]);
  });

  it('should pinch with two pointers and not swipe or pan after it', () => {
    down(1, 100, 100);
    move(1, 105, 100);
    down(2, 200, 100);
    move(2, 295, 100);
    time += 50;
    up(2, 295, 100);
    move(1, 50, 100);
    up(1, 50, 100);
    expect(host.pans).toEqual([
      {deltaX: 5, deltaY: 0, isFinal: false},
      {deltaX: 5, deltaY: 0, isFinal: true}
    ]);
    expect(host.pinches).toEqual([
      {scale: 2, isFinal: false},
      {scale: 2, isFinal: true}
    ]);
    expect(host.events).toEqual([]);
  });

  it('should stop listening on the window after the gesture', () => {
    down(1, 100, 100);
    up(1, 100, 100);
    move(1, 150, 100);
    expect(host.pans).toEqual([]);
  });
});
