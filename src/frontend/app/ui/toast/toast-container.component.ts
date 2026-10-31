import {Component, inject} from '@angular/core';
import {ToastService, ToastType} from './toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="toast-container position-fixed top-0 start-50 translate-middle-x p-3">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast show border-0 {{ CLASSES[toast.type] }}"
             [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
             aria-atomic="true"
             (click)="toastService.dismiss(toast.id)"
             (mouseenter)="toastService.pause(toast.id)"
             (mouseleave)="toastService.resume(toast.id)">
          <div class="toast-body">
            @if (toast.title) {
              <div class="fw-bold">{{ toast.title }}</div>
            }
            {{ toast.text }}
          </div>
        </div>
      }
    </div>`,
  styles: `
    .toast-container {
      z-index: 100000; /* above the lightbox */
    }

    .toast {
      cursor: pointer;
      overflow-wrap: anywhere;
      animation: toast-in 0.2s ease-out;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(-1rem);
      }
    }
  `
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  readonly CLASSES: Record<ToastType, string> = {
    success: 'text-bg-success',
    error: 'text-bg-danger',
    warning: 'text-bg-warning',
    info: 'text-bg-info'
  };
}
