import {Pipe, PipeTransform} from '@angular/core';
import {TextSearchMatchingTypes} from '../ui/gallery/search/query-enrty/TextSearchMatchingTypes';

@Pipe({
  name: 'matchingTypeDescription'
})
export class MatchingTypeDescriptionPipe implements PipeTransform {
  transform(matchingType: string, isTextQuery: boolean): string {
    return TextSearchMatchingTypes.getDescription(matchingType, isTextQuery);
  }
}
