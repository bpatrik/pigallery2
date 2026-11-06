import {Pipe, PipeTransform} from '@angular/core';

/**
 * Wraps an url into a css url() (e.g. for [style.background-image]).
 * Parentheses and quotes are escaped, so they can't break out of the url().
 */
export const toCssUrl = (url: string): string =>
  'url(' +
  url.replace(/\(/g, '%28')
    .replace(/'/g, '%27')
    .replace(/\)/g, '%29') +
  ')';

@Pipe({
  name: 'cssUrl'
})
export class CssUrlPipe implements PipeTransform {
  transform(url: string | null): string {
    return url === null ? 'none' : toCssUrl(url);
  }
}
