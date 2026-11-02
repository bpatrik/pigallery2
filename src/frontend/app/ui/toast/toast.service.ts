import {inject, Injectable, signal} from '@angular/core';
import {AuthenticationService} from '../../model/network/authentication.service';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'progress';
export type ToastPlacement = 'top-center' | 'bottom-right';

export interface ToastOptions {
  type: ToastType;
  title?: string;
  text?: string;
  // ms until the toast hides, paused while the mouse is over it. Without it, the toast stays until it is closed.
  timeout?: number;
  // 0-100, shown as the bar when there is no timeout
  progress?: number;
  // Default: top-center if the toast hides by itself, bottom-right if it stays
  placement?: ToastPlacement;
  // Toasts of a group collapse into a summary card, see registerGroup()
  group?: string;
  // Shows a close button and closes on click. Default: true
  closable?: boolean;
  // false: the title and the text are cut to one line. Default: true
  wrap?: boolean;
  // Shows a cancel button that calls it, e.g. to stop an upload
  onCancel?: () => void;
  // Overrides the icon and the Bootstrap color of the type
  icon?: string;
  color?: string;
}

export interface Toast extends ToastOptions {
  id: number;
  placement: ToastPlacement;
}

export interface ToastRef {
  update(changes: Partial<ToastOptions>): void;

  close(): void;
}

export interface ToastSummary {
  type: ToastType;
  title: string;
  text?: string;
  progress?: number;
  // The close button closes every toast of the group
  closable?: boolean;
  // Shows a cancel button that calls it, e.g. to stop every upload
  onCancel?: () => void;
  icon?: string;
  color?: string;
}

export interface ToastGroup {
  // The group collapses when it has more toasts than this
  collapseAfter: number;
  // Toasts that stay visible while collapsed, the newest ones
  visibleWhenCollapsed: number;
  // The card that stands for the hidden toasts (collapsed) or for the whole group (expanded). Clicking it toggles.
  summary: (toasts: Toast[], hidden: Toast[], expanded: boolean) => ToastSummary;
}

interface Timer {
  handle: number;
  deadline: number;
  remaining: number;
}

/**
 * Toasts of the whole app, shown by ToastContainerComponent. Only for logged-in users.
 */
@Injectable({providedIn: 'root'})
export class ToastService {
  static readonly TIMEOUT = 5000; // ms

  readonly toasts = signal<Toast[]>([]);
  readonly expandedGroups = signal<string[]>([]);
  private authService = inject(AuthenticationService);
  private groups = new Map<string, ToastGroup>();
  private timers = new Map<number, Timer>();
  private nextId = 0;

  constructor() {
    // e.g. no toasts left on the login page after a logout
    this.authService.user.subscribe(() => {
      if (!this.authService.isAuthenticated()) {
        this.clear();
      }
    });
  }

  registerGroup(name: string, group: ToastGroup): void {
    this.groups.set(name, group);
  }

  getGroup(name: string): ToastGroup {
    return this.groups.get(name);
  }

  open(options: ToastOptions): ToastRef {
    if (!this.authService.isAuthenticated()) {
      return {
        update: (): void => {
        }, close: (): void => {
        }
      };
    }
    const toast: Toast = {
      closable: true,
      wrap: true,
      ...options,
      id: this.nextId++,
      placement: options.placement || (options.timeout ? 'top-center' : 'bottom-right')
    };
    this.toasts.update((toasts) => [...toasts, toast]);
    this.startTimer(toast);
    return {
      update: (changes): void => this.update(toast.id, changes),
      close: (): void => this.dismiss(toast.id)
    };
  }

  update(id: number, changes: Partial<ToastOptions>): void {
    let updated: Toast = null;
    this.toasts.update((toasts) => toasts.map((t) => {
      if (t.id !== id) {
        return t;
      }
      updated = {...t, ...changes, id: t.id, placement: t.placement};
      return updated;
    }));
    if (updated && changes.timeout !== undefined) {
      this.stopTimer(id);
      this.startTimer(updated);
    }
  }

  dismiss(id: number): void {
    this.stopTimer(id);
    this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  dismissGroup(group: string): void {
    this.toasts().filter((t) => t.group === group).forEach((t) => this.dismiss(t.id));
  }

  clear(): void {
    this.timers.forEach((t) => clearTimeout(t.handle));
    this.timers.clear();
    this.toasts.set([]);
    this.expandedGroups.set([]);
  }

  // Stops the timeout while the mouse is over the toast
  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle === null) {
      return;
    }
    clearTimeout(timer.handle);
    timer.handle = null;
    timer.remaining = timer.deadline - Date.now();
  }

  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle !== null) {
      return;
    }
    this.schedule(id, timer.remaining);
  }

  isExpanded(group: string): boolean {
    return this.expandedGroups().includes(group);
  }

  toggleGroup(group: string): void {
    this.expandedGroups.update((groups) =>
      groups.includes(group) ? groups.filter((g) => g !== group) : [...groups, group]);
  }

  private startTimer(toast: Toast): void {
    if (toast.timeout) {
      this.schedule(toast.id, toast.timeout);
    }
  }

  private schedule(id: number, ms: number): void {
    this.timers.set(id, {
      handle: window.setTimeout(() => this.dismiss(id), ms),
      deadline: Date.now() + ms,
      remaining: ms
    });
  }

  private stopTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer.handle);
      this.timers.delete(id);
    }
  }
}
