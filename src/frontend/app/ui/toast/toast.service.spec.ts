import {TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {ToastService} from './toast.service';
import {AuthenticationService} from '../../model/network/authentication.service';

class MockToastAuthenticationService {
  user = new BehaviorSubject<unknown>({name: 'admin'});

  isAuthenticated(): boolean {
    return !!this.user.value;
  }
}

describe('ToastService', () => {
  let service: ToastService;
  let auth: MockToastAuthenticationService;

  beforeEach(() => {
    auth = new MockToastAuthenticationService();
    TestBed.configureTestingModule({providers: [{provide: AuthenticationService, useValue: auth}]});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should place toasts that hide by themselves at the top and the others at the bottom right', () => {
    service.open({type: 'success', text: 'Saved', timeout: ToastService.TIMEOUT});
    service.open({type: 'progress', title: 'Balaton.jpg', progress: 0});
    service.open({type: 'warning', text: 'Skipped', timeout: ToastService.TIMEOUT, placement: 'bottom-right'});
    expect(service.toasts().map((t) => t.placement)).toEqual(['top-center', 'bottom-right', 'bottom-right']);
  });

  it('should hide a toast after its timeout and keep the ones without', async () => {
    vi.useFakeTimers();
    service.open({type: 'info', text: 'Job started', timeout: ToastService.TIMEOUT});
    service.open({type: 'error', text: 'Upload failed'});
    await vi.advanceTimersByTimeAsync(ToastService.TIMEOUT - 1);
    expect(service.toasts().length).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(service.toasts().map((t) => t.text)).toEqual(['Upload failed']);
  });

  it('should pause the timeout and continue with the remaining time', async () => {
    vi.useFakeTimers();
    service.open({type: 'info', text: 'Job started', timeout: 1000});
    const id = service.toasts()[0].id;
    await vi.advanceTimersByTimeAsync(400);
    service.pause(id);
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.toasts().length).toBe(1);
    service.resume(id);
    await vi.advanceTimersByTimeAsync(599);
    expect(service.toasts().length).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(service.toasts().length).toBe(0);
  });

  it('should update a toast and start its timeout when it gets one', async () => {
    vi.useFakeTimers();
    const ref = service.open({type: 'progress', title: 'Tihany.jpg', progress: 0, closable: false});
    ref.update({progress: 50, text: '50%'});
    expect(service.toasts()[0]).toEqual(expect.objectContaining({progress: 50, text: '50%', placement: 'bottom-right'}));
    await vi.advanceTimersByTimeAsync(60000);
    expect(service.toasts().length).toBe(1);
    ref.update({type: 'success', progress: 100, timeout: 1000, closable: true});
    expect(service.toasts()[0].placement).toBe('bottom-right'); // stays where it was
    await vi.advanceTimersByTimeAsync(1000);
    expect(service.toasts().length).toBe(0);
  });

  it('should close every toast of a group', () => {
    service.open({type: 'error', text: 'a', group: 'uploads'});
    service.open({type: 'error', text: 'b', group: 'uploads'});
    service.open({type: 'info', text: 'c'});
    service.dismissGroup('uploads');
    expect(service.toasts().map((t) => t.text)).toEqual(['c']);
  });

  it('should show no toasts while logged out', () => {
    service.open({type: 'error', text: 'Upload failed'});
    auth.user.next(null);
    expect(service.toasts().length).toBe(0);
    service.open({type: 'info', text: 'Hello'});
    expect(service.toasts().length).toBe(0);
  });
});
