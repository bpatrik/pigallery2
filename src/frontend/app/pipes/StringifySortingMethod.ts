import {Pipe, type PipeTransform} from '@angular/core';
import {GroupByTypes, SortByTypes} from '../../../common/entities/SortingMethods';
import {EnumTranslations} from '../ui/EnumTranslations';

@Pipe({
    name: 'stringifySorting',
    standalone: true
})
export class StringifySortingMethod implements PipeTransform {

  transform(method: number): string {
    return EnumTranslations[SortByTypes[method] || GroupByTypes[method]];
  }
}

