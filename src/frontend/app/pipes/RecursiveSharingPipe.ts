import {Pipe, PipeTransform} from '@angular/core';
import {ResponseSharingDTO} from '../../../common/entities/SharingDTO';
import {TextSearchQueryMatchTypes} from '../../../common/entities/SearchQueryDTO';

/**
 * True if the sharing shares a directory with its subdirectories (a 'path/*' glob).
 */
@Pipe({
  name: 'recursiveSharing'
})
export class RecursiveSharingPipe implements PipeTransform {
  transform(share: ResponseSharingDTO): boolean {
    return share.directoryQuery?.matchType === TextSearchQueryMatchTypes.globMatch &&
      share.directoryQuery.value?.endsWith('*');
  }
}
