import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'parseInt'})
export class ParseIntPipe implements PipeTransform {

  transform(num: string): number {
    return parseInt(num);
  }
}

