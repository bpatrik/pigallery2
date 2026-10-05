import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {LightboxGesturesDirective} from './lightbox-gestures.directive';

@Component({
  imports: [LightboxGesturesDirective],
  template: `<div appLightboxGestures
    (swipeleft)="swipes.push('left')" (swiperight)="swipes.push('right')" (swipeup)="swipes.push('up')"
    (pan)="pans.push($event)" (pinch)="scales.push($event.scale)" (pinchend)="ends.push($event.scale)"
    (tap)="taps.push($event.tapCount)"><a href="#">Link</a></div>`
})
class GestureHost {
  swipes: string[] = [];
  pans: {deltaX: number; deltaY: number; isFinal: boolean}[] = [];
  scales: number[] = [];
  ends: number[] = [];
  taps: number[] = [];
}

describe('Lightbox pointer gestures', () => {
  let fixture: ComponentFixture<GestureHost>;
  let element: HTMLElement;
  let host: GestureHost;
  let time: number;

  const pointer = (type: string, x: number, y: number, id = 1, target = element): void => {
    const event = new PointerEvent(type, {pointerId: id, pointerType: 'touch', button: 0,
      clientX: x, clientY: y, bubbles: true});
    Object.defineProperty(event, 'timeStamp', {value: time += 20});
    target.dispatchEvent(event);
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(GestureHost);
    fixture.detectChanges();
    host = fixture.componentInstance;
    element = fixture.nativeElement.querySelector('div');
    time = 1000;
  });

  it('navigates left, right and up using a single pointer', () => {
    for (const [x, y] of [[-100, 0], [100, 0], [0, -100]]) {
      pointer('pointerdown', 200, 200);
      pointer('pointermove', 200 + x, 200 + y);
      pointer('pointerup', 200 + x, 200 + y);
    }
    expect(host.swipes).toEqual(['left', 'right', 'up']);
    expect(host.taps).toEqual([]);
  });

  it('distinguishes a double tap from a drag and a long press', () => {
    pointer('pointerdown', 200, 200);
    pointer('pointerup', 200, 200);
    pointer('pointerdown', 201, 201);
    pointer('pointerup', 201, 201);
    pointer('pointerdown', 200, 200);
    time += 1000;
    pointer('pointerup', 200, 200);
    pointer('pointerdown', 200, 200);
    time += 1000;
    pointer('pointerup', 220, 220);
    expect(host.taps).toEqual([1, 2]);
    expect(host.swipes).toEqual([]);
  });

  it('reports drag deltas and a final position', () => {
    pointer('pointerdown', 200, 200);
    pointer('pointermove', 220, 240);
    pointer('pointerup', 230, 250);
    expect(host.pans).toEqual([
      {deltaX: 20, deltaY: 40, isFinal: false},
      {deltaX: 30, deltaY: 50, isFinal: true}
    ]);
  });

  it('scales with two pointers without navigating or tapping on release', () => {
    pointer('pointerdown', 100, 200);
    pointer('pointerdown', 200, 200, 2);
    pointer('pointermove', 300, 200, 2);
    pointer('pointerup', 300, 200, 2);
    pointer('pointermove', 0, 200);
    pointer('pointerup', 0, 200);
    expect(host.scales).toEqual([2]);
    expect(host.ends).toEqual([2]);
    expect(host.swipes).toEqual([]);
    expect(host.taps).toEqual([]);
  });

  it('clears cancelled gestures and accepts the next interaction', () => {
    pointer('pointerdown', 200, 200);
    pointer('pointermove', 0, 200);
    pointer('pointercancel', 0, 0);
    pointer('pointerdown', 200, 200);
    pointer('pointerup', 200, 200);
    expect(host.swipes).toEqual([]);
    expect(host.taps).toEqual([1]);
    expect(host.pans[1]).toEqual({deltaX: -200, deltaY: 0, isFinal: true});
  });

  it('ends a cancelled pinch once even when pointer capture is subsequently lost', () => {
    pointer('pointerdown', 100, 200);
    pointer('pointerdown', 200, 200, 2);
    pointer('pointermove', 300, 200, 2);
    pointer('pointercancel', 0, 0, 2);
    pointer('lostpointercapture', 0, 0, 2);
    pointer('pointerup', 100, 200);
    expect(host.ends).toEqual([2]);
    expect(host.swipes).toEqual([]);
    expect(host.taps).toEqual([]);
  });

  it('leaves interactive child elements to their own handlers', () => {
    const link = element.querySelector('a');
    pointer('pointerdown', 200, 200, 1, link);
    pointer('pointerup', 200, 200, 1, link);
    expect(host.taps).toEqual([]);
    expect(host.pans).toEqual([]);
  });
});
