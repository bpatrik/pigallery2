import {Directive, OnDestroy, output} from '@angular/core';

export interface PanEvent {
  deltaX: number;
  deltaY: number;
  isFinal: boolean;
}

export interface PinchEvent {
  scale: number;
  isFinal: boolean;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Swipe, double tap, pan and pinch from pointer events (touch, pen and mouse).
 * The thresholds follow the HammerJS defaults the lightbox used before.
 * The element needs `touch-action: none`, otherwise the browser scrolls and zooms instead.
 */
@Directive({
  selector: '[appGesture]',
  host: {
    '(pointerdown)': 'onPointerDown($event)'
  }
})
export class GestureDirective implements OnDestroy {
  private static readonly PAN_THRESHOLD = 1; // px
  private static readonly SWIPE_THRESHOLD = 10; // px
  private static readonly SWIPE_VELOCITY = 0.3; // px/ms
  private static readonly TAP_THRESHOLD = 9; // px, a tap may move this much
  private static readonly TAP_TIME = 250; // ms, a tap is shorter than this
  private static readonly DOUBLE_TAP_INTERVAL = 300; // ms
  private static readonly DOUBLE_TAP_DISTANCE = 10; // px

  readonly swipeLeft = output();
  readonly swipeRight = output();
  readonly swipeUp = output();
  readonly doubleTap = output();
  readonly pan = output<PanEvent>();
  readonly pinch = output<PinchEvent>();

  private pointers = new Map<number, Point>();
  private start: Point & { time: number } = null;
  // A second pointer joined: this gesture is a pinch, so no more pan, swipe or tap until every pointer is up.
  private multiTouch = false;
  private panning = false;
  private pinchStartDistance = 0;
  private pinchScale = 1;
  private lastTap: Point & { time: number } = null;

  ngOnDestroy(): void {
    this.listen(false);
  }

  onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    if (this.pointers.has(e.pointerId)) {
      // We missed the pointerup (e.g. the mouse was released outside the window)
      this.reset();
    }
    if (this.pointers.size === 0) {
      this.start = {x: e.clientX, y: e.clientY, time: e.timeStamp};
      this.multiTouch = false;
      this.panning = false;
      this.listen(true);
    }
    this.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (this.pointers.size === 2) {
      this.endPan();
      this.multiTouch = true;
      this.pinchStartDistance = this.pointerDistance();
      this.pinchScale = 1;
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) {
      return;
    }
    this.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (!this.multiTouch) {
      const d = this.delta();
      if (!this.panning && Math.hypot(d.x, d.y) >= GestureDirective.PAN_THRESHOLD) {
        this.panning = true;
      }
      if (this.panning) {
        this.pan.emit({deltaX: d.x, deltaY: d.y, isFinal: false});
      }
    } else if (this.pointers.size >= 2 && this.pinchStartDistance > 0) {
      this.pinchScale = this.pointerDistance() / this.pinchStartDistance;
      this.pinch.emit({scale: this.pinchScale, isFinal: false});
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) {
      return;
    }
    this.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (this.pointers.size === 2 && this.pinchStartDistance > 0) {
      this.pinch.emit({scale: this.pinchScale, isFinal: true});
      this.pinchStartDistance = 0;
    } else if (!this.multiTouch) {
      const d = this.delta();
      this.endPan();
      if (e.type === 'pointerup') {
        const duration = e.timeStamp - this.start.time;
        this.detectSwipe(d, duration);
        this.detectTap(d, duration, e);
      }
    }
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.listen(false);
    }
  };

  private detectSwipe(d: Point, duration: number): void {
    if (Math.hypot(d.x, d.y) <= GestureDirective.SWIPE_THRESHOLD || duration <= 0) {
      return;
    }
    const horizontal = Math.abs(d.x) >= Math.abs(d.y);
    const velocity = Math.abs(horizontal ? d.x : d.y) / duration;
    if (velocity <= GestureDirective.SWIPE_VELOCITY) {
      return;
    }
    if (horizontal) {
      if (d.x < 0) {
        this.swipeLeft.emit();
      } else {
        this.swipeRight.emit();
      }
    } else if (d.y < 0) {
      this.swipeUp.emit();
    }
  }

  private detectTap(d: Point, duration: number, e: PointerEvent): void {
    if (duration >= GestureDirective.TAP_TIME || Math.hypot(d.x, d.y) >= GestureDirective.TAP_THRESHOLD) {
      return;
    }
    const tap = {x: e.clientX, y: e.clientY, time: e.timeStamp};
    if (this.lastTap &&
      tap.time - this.lastTap.time < GestureDirective.DOUBLE_TAP_INTERVAL &&
      Math.hypot(tap.x - this.lastTap.x, tap.y - this.lastTap.y) < GestureDirective.DOUBLE_TAP_DISTANCE) {
      this.lastTap = null;
      this.doubleTap.emit();
      return;
    }
    this.lastTap = tap;
  }

  private endPan(): void {
    if (!this.panning) {
      return;
    }
    this.panning = false;
    const d = this.delta();
    this.pan.emit({deltaX: d.x, deltaY: d.y, isFinal: true});
  }

  // Movement of the first pointer since the gesture started
  private delta(): Point {
    const p = this.pointers.values().next().value;
    return {x: p.x - this.start.x, y: p.y - this.start.y};
  }

  private pointerDistance(): number {
    const [a, b] = Array.from(this.pointers.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private reset(): void {
    this.endPan();
    if (this.pinchStartDistance > 0) {
      this.pinch.emit({scale: this.pinchScale, isFinal: true});
      this.pinchStartDistance = 0;
    }
    this.pointers.clear();
    this.listen(false);
  }

  // Listen on the window, so the gesture continues when the pointer moves over the lightbox controls.
  private listen(on: boolean): void {
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('pointermove', this.onPointerMove);
    window[method]('pointerup', this.onPointerUp);
    window[method]('pointercancel', this.onPointerUp);
  }
}
