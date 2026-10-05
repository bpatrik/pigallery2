import {Pipe, type PipeTransform} from '@angular/core';
import {EnumTranslations} from '../ui/EnumTranslations';
import {GridSizes} from '../../../common/entities/GridSizes';

@Pipe({
    name: 'stringifyGridSize',
    standalone: true
})
export class StringifyGridSize implements PipeTransform {

  transform(gs: GridSizes): string {
    return EnumTranslations[GridSizes[gs]];
  }
}

