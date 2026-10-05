import {Directive, ElementRef, EventEmitter, HostListener, Output} from '@angular/core';

interface PointerPosition { x: number; y: number; }

@Directive({
  selector: '[appLightboxGestures]',
  host: {style: 'touch-action: none; user-select: none;'}
})
export class LightboxGesturesDirective {
  @Output() swipeleft = new EventEmitter<void>();
  @Output() swiperight = new EventEmitter<void>();
  @Output() swipeup = new EventEmitter<void>();
  @Output() pan = new EventEmitter<{deltaX: number; deltaY: number; isFinal: boolean}>();
  @Output() pinch = new EventEmitter<{scale: number}>();
  @Output() pinchstart = new EventEmitter<void>();
  @Output() pinchend = new EventEmitter<{scale: number}>();
  @Output() tap = new EventEmitter<{tapCount: number}>();

  private pointers = new Map<number, PointerPosition>();
  private start: PointerPosition;
  private startTime = 0;
  private pinchDistance = 0;
  private hadPinch = false;
  private lastTap: PointerPosition;
  private lastTapTime = 0;

  constructor(private element: ElementRef<HTMLElement>) {}

  @HostListener('pointerdown', ['$event'])
  pointerDown(event: PointerEvent): void {
    if (event.button !== 0 || (event.target as HTMLElement).closest('a, button, input, select, textarea')) {
      return;
    }
    const position = {x: event.clientX, y: event.clientY};
    if (this.pointers.size === 0) {
      this.start = position;
      this.startTime = event.timeStamp;
      this.hadPinch = false;
    }
    this.pointers.set(event.pointerId, position);
    if (event.isTrusted) {
      this.element.nativeElement.setPointerCapture(event.pointerId);
    }
    if (this.pointers.size === 2) {
      this.pinchDistance = this.distance();
      this.hadPinch = true;
      this.lastTap = undefined;
      this.pinchstart.emit();
    }
  }

  @HostListener('pointermove', ['$event'])
  pointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) {
      return;
    }
    this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (this.pointers.size === 2 && this.pinchDistance > 0) {
      this.pinch.emit({scale: this.distance() / this.pinchDistance});
    } else if (!this.hadPinch) {
      this.pan.emit({...this.delta(event), isFinal: false});
    }
  }

  @HostListener('pointerup', ['$event'])
  pointerUp(event: PointerEvent): void {
    this.finish(event, false);
  }

  @HostListener('pointercancel', ['$event'])
  @HostListener('lostpointercapture', ['$event'])
  pointerCancel(event: PointerEvent): void {
    this.finish(event, true);
  }

  private finish(event: PointerEvent, cancelled: boolean): void {
    if (!this.pointers.has(event.pointerId)) {
      return;
    }
    // Cancellation coordinates may be zero; retain the last known position.
    if (!cancelled) {
      this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    }
    if (this.pointers.size === 2 && this.pinchDistance > 0) {
      this.pinchend.emit({scale: this.distance() / this.pinchDistance});
    }
    const position = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (this.hadPinch) {
      return;
    }
    const delta = {deltaX: position.x - this.start.x, deltaY: position.y - this.start.y};
    this.pan.emit({...delta, isFinal: true});
    const elapsed = Math.max(1, event.timeStamp - this.startTime);
    const distance = Math.hypot(delta.deltaX, delta.deltaY);
    if (cancelled) {
      this.lastTap = undefined;
      return;
    }
    if (distance >= 30 && distance / elapsed >= 0.3) {
      this.lastTap = undefined;
      if (Math.abs(delta.deltaX) >= Math.abs(delta.deltaY)) {
        (delta.deltaX < 0 ? this.swipeleft : this.swiperight).emit();
      } else if (delta.deltaY < 0) {
        this.swipeup.emit();
      }
    } else if (distance <= 10 && elapsed <= 250) {
      const doubleTap = this.lastTap && event.timeStamp - this.lastTapTime <= 300 &&
        Math.hypot(event.clientX - this.lastTap.x, event.clientY - this.lastTap.y) <= 25;
      this.tap.emit({tapCount: doubleTap ? 2 : 1});
      this.lastTap = doubleTap ? undefined : {x: event.clientX, y: event.clientY};
      this.lastTapTime = event.timeStamp;
    }
  }

  private delta(event: PointerEvent): {deltaX: number; deltaY: number} {
    return {deltaX: event.clientX - this.start.x, deltaY: event.clientY - this.start.y};
  }

  private distance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
