import {Pipe, type PipeTransform} from '@angular/core';
import {EnumTranslations} from '../ui/EnumTranslations';

@Pipe({
    name: 'stringifyEnum',
    standalone: true
})
export class StringifyEnum implements PipeTransform {

  transform(name: string): string {
    return EnumTranslations[name] || name;
  }
}

