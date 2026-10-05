import {Pipe, type PipeTransform} from '@angular/core';

@Pipe({
    name: 'parseInt',
    standalone: true
})
export class ParseIntPipe implements PipeTransform {

  transform(num: string): number {
    return parseInt(num);
  }
}

