import {Pipe, PipeTransform} from '@angular/core';
import {MediaDTO, MediaDTOUtils} from '../../../common/entities/MediaDTO';
import {PhotoDTO} from '../../../common/entities/PhotoDTO';
import {MediaGroup} from '../ui/gallery/navigator/sorting.service';

@Pipe({name: 'photosOnly'})
export class PhotoFilterPipe implements PipeTransform {
  transform(mediaGroups: MediaGroup[]): PhotoDTO[] | null {
    if (!mediaGroups) {
      return null;
    }
    const ret = [];
    for (let i = 0; i < mediaGroups.length; ++i) {
      ret.push(...mediaGroups[i].media.filter((m: MediaDTO): boolean =>
          MediaDTOUtils.isPhoto(m)
      ) as PhotoDTO[]);
    }
    return ret;
  }
}
