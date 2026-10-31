import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {copyToClipboard, CopyDirective} from './copy.directive';

@Component({
  template: `<button [appCopy]="text" (copied)="copied = copied + 1">Copy</button>`,
  imports: [CopyDirective]
})
class HostComponent {
  text = 'http://192.168.1.2/share/árvíztűrő';
  copied = 0;
}

describe('copyToClipboard', () => {

  it('should use navigator.clipboard in a secure context', async () => {
    const writeText = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    expect(await copyToClipboard('text')).toBeTrue();
    expect(writeText).toHaveBeenCalledWith('text');
  });

  it('should fall back to a textarea without navigator.clipboard (plain http)', async () => {
    spyOnProperty(window, 'isSecureContext').and.returnValue(false);
    let copied: string = null;
    spyOn(document, 'execCommand').and.callFake((command: string): boolean => {
      copied = command === 'copy' ? (document.activeElement as HTMLTextAreaElement).value : null;
      return true;
    });
    expect(await copyToClipboard('fallback')).toBeTrue();
    expect(copied).toBe('fallback');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('should report a refused copy', async () => {
    spyOnProperty(window, 'isSecureContext').and.returnValue(false);
    spyOn(document, 'execCommand').and.returnValue(false);
    expect(await copyToClipboard('text')).toBeFalse();
  });
});

describe('CopyDirective', () => {

  it('should copy the bound text on click and emit copied', async () => {
    const writeText = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith('http://192.168.1.2/share/árvíztűrő');
    expect(fixture.componentInstance.copied).toBe(1);
  });
});
