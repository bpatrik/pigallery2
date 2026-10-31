import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideIcons} from '@ng-icons/core';
import {ToastCardComponent} from './toast-card.component';
import {appIcons} from '../../icons';

@Component({
  template: `
    <app-toast-card icon="ionCloudUploadOutline" [color]="color" [wrap]="false" [progress]="progress">
      <span toastTitle>Balaton_naplemente.jpg</span>
      <span>{{ progress }}%</span>
      <button toastAction>x</button>
    </app-toast-card>`,
  imports: [ToastCardComponent]
})
class HostComponent {
  color = 'primary';
  progress = 45;
}

describe('ToastCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let card: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideIcons(appIcons)]});
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    card = fixture.nativeElement.querySelector('app-toast-card');
  });

  it('should project the title, text and action', () => {
    expect(card.querySelector('.toast-title').textContent).toBe('Balaton_naplemente.jpg');
    expect(card.querySelector('.toast-text').textContent).toBe('45%');
    expect(card.querySelector('button[toastAction]')).toBeTruthy();
  });

  it('should show the progress as the bar width in the given color', () => {
    const bar: HTMLElement = card.querySelector('.toast-bar');
    expect(bar.style.width).toBe('45%');
    expect(bar.classList).toContain('bg-primary');
    expect(bar.classList).not.toContain('countdown');
    fixture.componentInstance.progress = 100;
    fixture.componentInstance.color = 'success';
    fixture.detectChanges();
    expect(bar.style.width).toBe('100%');
    expect(card.querySelector('.toast-icon').classList).toContain('text-success');
  });

  it('should keep the text on one line when wrap is off', () => {
    expect(card.classList).toContain('single-line');
  });
});
