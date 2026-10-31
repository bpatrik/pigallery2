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

// jsdom has no clipboard, secure context or execCommand, so each test sets up the browser it needs
const setUpBrowser = (secure: boolean, execCommand: (command: string) => boolean = () => true) => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
  Object.defineProperty(window, 'isSecureContext', {value: secure, configurable: true});
  document.execCommand = vi.fn(execCommand);
  return writeText;
};

afterEach(() => {
  delete (navigator as {clipboard?: Clipboard}).clipboard;
  delete (window as {isSecureContext?: boolean}).isSecureContext;
  delete (document as Partial<Document>).execCommand;
});

describe('copyToClipboard', () => {

  it('should use navigator.clipboard in a secure context', async () => {
    const writeText = setUpBrowser(true);
    expect(await copyToClipboard('text')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('text');
  });

  it('should fall back to a textarea without navigator.clipboard (plain http)', async () => {
    let copied: string = null;
    setUpBrowser(false, (command: string): boolean => {
      const textarea = document.querySelector('textarea');
      copied = command === 'copy' ? textarea.value.substring(textarea.selectionStart, textarea.selectionEnd) : null;
      return true;
    });
    expect(await copyToClipboard('fallback')).toBe(true);
    expect(copied).toBe('fallback');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('should report a refused copy', async () => {
    setUpBrowser(false, () => false);
    expect(await copyToClipboard('text')).toBe(false);
  });
});

describe('CopyDirective', () => {

  it('should copy the bound text on click and emit copied', async () => {
    const writeText = setUpBrowser(true);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith('http://192.168.1.2/share/árvíztűrő');
    expect(fixture.componentInstance.copied).toBe(1);
  });
});
