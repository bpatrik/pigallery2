import {Pipe, PipeTransform} from '@angular/core';
import {EnumTranslations} from '../ui/EnumTranslations';
import {SearchQueryTypes} from '../../../common/entities/SearchQueryDTO';

@Pipe({name: 'stringifySearchType'})
export class StringifySearchType implements PipeTransform {

  transform(type: SearchQueryTypes): string {
    return EnumTranslations[SearchQueryTypes[type]];
  }
}

