import {Pipe, type PipeTransform} from '@angular/core';
import {type MediaDTO, MediaDTOUtils} from '../../../common/entities/MediaDTO';
import {type PhotoDTO} from '../../../common/entities/PhotoDTO';
import {type MediaGroup} from '../ui/gallery/navigator/sorting.service';

@Pipe({
    name: 'photosOnly',
    standalone: true
})
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
