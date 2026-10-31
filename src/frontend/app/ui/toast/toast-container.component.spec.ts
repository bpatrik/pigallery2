import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideIcons} from '@ng-icons/core';
import {ToastContainerComponent} from './toast-container.component';
import {ToastService} from './toast.service';
import {appIcons} from '../../icons';
import {AuthenticationService} from '../../model/network/authentication.service';
import {MockToastAuthenticationService} from './toast.service.spec';

describe('ToastContainerComponent', () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  let service: ToastService;

  const cards = (placement = 'top-center'): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`.${placement} app-toast-card`));
  const render = (): void => fixture.detectChanges();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideIcons(appIcons),
        {provide: AuthenticationService, useValue: new MockToastAuthenticationService()}
      ]
    });
    fixture = TestBed.createComponent(ToastContainerComponent);
    service = TestBed.inject(ToastService);
    render();
  });

  it('should show the newest toast on top with its title, text and color', () => {
    service.open({type: 'success', text: 'Saved', timeout: ToastService.TIMEOUT});
    service.open({type: 'error', text: 'Árvíztűrő hiba', title: '(1) Mentés sikertelen', timeout: ToastService.TIMEOUT});
    render();
    expect(cards().length).toBe(2);
    expect(cards()[0].getAttribute('role')).toBe('alert');
    expect(cards()[0].querySelector('.toast-icon').classList).toContain('text-danger');
    expect(cards()[0].querySelector('.toast-bar').classList).toContain('countdown');
    expect(cards()[0].querySelector('.toast-title').textContent).toContain('(1) Mentés sikertelen');
    expect(cards()[0].querySelector('.toast-text').textContent).toContain('Árvíztűrő hiba');
    expect(cards()[1].getAttribute('role')).toBe('status');
    expect(cards()[1].querySelector('.toast-icon').classList).toContain('text-success');
  });

  it('should show toasts that stay at the bottom right with their progress', () => {
    service.open({type: 'progress', title: 'Balaton.jpg', text: '45%', progress: 45, closable: false});
    render();
    expect(cards('top-center').length).toBe(0);
    const card = cards('bottom-right')[0];
    expect((card.querySelector('.toast-bar') as HTMLElement).style.width).toBe('45%');
    expect(card.querySelector('.btn-close')).toBeNull();
    card.click();
    render();
    expect(cards('bottom-right').length).toBe(1); // not closable
  });

  it('should close a toast on click and with its close button', () => {
    service.open({type: 'error', text: 'Failed'});
    service.open({type: 'warning', text: 'Careful'});
    render();
    (cards('bottom-right')[0].querySelector('.btn-close') as HTMLElement).click();
    render();
    expect(cards('bottom-right').map((c) => c.textContent)).toEqual([jasmine.stringContaining('Careful')]);
    cards('bottom-right')[0].click();
    render();
    expect(cards('bottom-right').length).toBe(0);
  });

  it('should call the cancel action without closing the toast by the click', () => {
    const onCancel = jasmine.createSpy('onCancel');
    service.open({type: 'progress', title: 'Balaton.jpg', progress: 30, closable: true, onCancel});
    render();
    (cards('bottom-right')[0].querySelector('.toast-cancel') as HTMLElement).click();
    render();
    expect(onCancel).toHaveBeenCalled();
    expect(cards('bottom-right').length).toBe(1); // the owner closes it
  });

  describe('group', () => {
    beforeEach(() => {
      service.registerGroup('notifications', {
        collapseAfter: 3,
        visibleWhenCollapsed: 3,
        summary: (toasts, hidden, expanded) => ({
          type: 'info',
          title: expanded ? 'Show fewer' : 'More: ' + hidden.length,
          closable: true
        })
      });
    });

    const notify = (n: number): void => {
      for (let i = 0; i < n; i++) {
        service.open({type: 'error', text: 'Error ' + i, timeout: ToastService.TIMEOUT, group: 'notifications'});
      }
      render();
    };

    it('should not collapse up to the limit', () => {
      notify(3);
      expect(cards().length).toBe(3);
      expect(fixture.nativeElement.querySelector('.summary')).toBeNull();
    });

    it('should show the newest toasts and a summary for the rest, and expand on click', () => {
      notify(5);
      expect(cards().map((c) => c.textContent.trim())).toEqual([
        jasmine.stringContaining('Error 4'),
        jasmine.stringContaining('Error 3'),
        jasmine.stringContaining('Error 2'),
        jasmine.stringContaining('More: 2')
      ]);
      cards()[3].click();
      render();
      expect(cards().length).toBe(6);
      expect(cards()[5].textContent).toContain('Show fewer');
    });

    it('should close the whole group from the summary', () => {
      notify(5);
      (fixture.nativeElement.querySelector('.summary .btn-close') as HTMLElement).click();
      render();
      expect(cards().length).toBe(0);
    });
  });
});
