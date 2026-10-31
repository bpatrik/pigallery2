import {Injectable, signal} from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  text: string;
  title: string;
}

/**
 * Toasts shown by ToastContainerComponent, newest on top.
 * A toast hides after a timeout, waits while the mouse is over it and hides on click.
 */
@Injectable({providedIn: 'root'})
export class ToastService {
  static readonly TIMEOUT = 5000; // ms
  static readonly EXTENDED_TIMEOUT = 1000; // ms, after the mouse left the toast

  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;
  private timers = new Map<number, number>();

  show(type: ToastType, text: string, title: string = null): void {
    const toast: Toast = {id: this.nextId++, type, text, title};
    this.toasts.update((toasts) => [toast, ...toasts]);
    this.startTimer(toast.id, ToastService.TIMEOUT);
  }

  dismiss(id: number): void {
    this.pause(id);
    this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  pause(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }

  resume(id: number): void {
    this.startTimer(id, ToastService.EXTENDED_TIMEOUT);
  }

  private startTimer(id: number, timeout: number): void {
    this.pause(id);
    this.timers.set(id, window.setTimeout(() => this.dismiss(id), timeout));
  }
}
