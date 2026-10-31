import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {ToastContainerComponent} from './toast-container.component';
import {ToastService} from './toast.service';

describe('ToastContainerComponent', () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  let service: ToastService;

  const toasts = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.toast'));

  beforeEach(() => {
    fixture = TestBed.createComponent(ToastContainerComponent);
    service = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('should show the newest toast on top with its title and color', () => {
    service.show('success', 'Saved');
    service.show('error', 'Árvíztűrő hiba', 'Server error');
    fixture.detectChanges();
    expect(toasts().length).toBe(2);
    expect(toasts()[0].classList).toContain('text-bg-danger');
    expect(toasts()[0].getAttribute('role')).toBe('alert');
    expect(toasts()[0].textContent).toContain('Server error');
    expect(toasts()[0].textContent).toContain('Árvíztűrő hiba');
    expect(toasts()[1].classList).toContain('text-bg-success');
    expect(toasts()[1].getAttribute('role')).toBe('status');
  });

  it('should hide a toast after the timeout', fakeAsync(() => {
    service.show('info', 'Job started');
    tick(ToastService.TIMEOUT - 1);
    expect(service.toasts().length).toBe(1);
    tick(1);
    expect(service.toasts().length).toBe(0);
  }));

  it('should keep a toast while the mouse is over it', fakeAsync(() => {
    service.show('warning', 'Careful');
    fixture.detectChanges();
    toasts()[0].dispatchEvent(new Event('mouseenter'));
    tick(ToastService.TIMEOUT * 2);
    expect(service.toasts().length).toBe(1);
    toasts()[0].dispatchEvent(new Event('mouseleave'));
    tick(ToastService.EXTENDED_TIMEOUT);
    expect(service.toasts().length).toBe(0);
  }));

  it('should hide a toast on click', fakeAsync(() => {
    service.show('success', 'Saved');
    fixture.detectChanges();
    toasts()[0].click();
    fixture.detectChanges();
    expect(toasts().length).toBe(0);
    tick(ToastService.TIMEOUT);
  }));
});
