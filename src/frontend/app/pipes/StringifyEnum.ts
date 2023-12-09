import {Pipe, PipeTransform} from '@angular/core';
import {EnumTranslations} from '../ui/EnumTranslations';

@Pipe({name: 'stringifyEnum'})
export class StringifyEnum implements PipeTransform {

  transform(name: string): string {
    return EnumTranslations[name];
  }
}

