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
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    expect(await copyToClipboard('text')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('text');
  });

  it('should fall back to a textarea without navigator.clipboard (plain http)', async () => {
    vi.spyOn(window, 'isSecureContext', 'get').mockReturnValue(false);
    let copied: string = null;
    vi.spyOn(document, 'execCommand').mockImplementation((command: string): boolean => {
      const textarea = document.querySelector('textarea');
      copied = command === 'copy' ? textarea.value.substring(textarea.selectionStart, textarea.selectionEnd) : null;
      return true;
    });
    expect(await copyToClipboard('fallback')).toBe(true);
    expect(copied).toBe('fallback');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('should report a refused copy', async () => {
    vi.spyOn(window, 'isSecureContext', 'get').mockReturnValue(false);
    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    expect(await copyToClipboard('text')).toBe(false);
  });
});

describe('CopyDirective', () => {

  it('should copy the bound text on click and emit copied', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith('http://192.168.1.2/share/árvíztűrő');
    expect(fixture.componentInstance.copied).toBe(1);
  });
});
