import {Directive, input, output} from '@angular/core';

/**
 * Copies the text to the clipboard. Returns false if the browser refused it.
 * navigator.clipboard only exists in secure contexts (https or localhost), and many
 * installs run on plain http, so it falls back to copying from a hidden textarea.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // e.g. the document is not focused, try the fallback
    }
  }
  const focused = document.activeElement as HTMLElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    // execCommand is deprecated, but it is the only way to copy without a secure context
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    focused?.focus();
  }
}

/**
 * Copies the bound text on click: <button [appCopy]="url" (copied)="onCopy()">
 */
@Directive({
  selector: '[appCopy]',
  host: {
    '(click)': 'copy()'
  }
})
export class CopyDirective {
  readonly appCopy = input.required<string>();
  readonly copied = output();

  async copy(): Promise<void> {
    if (await copyToClipboard(this.appCopy())) {
      this.copied.emit();
    }
  }
}
