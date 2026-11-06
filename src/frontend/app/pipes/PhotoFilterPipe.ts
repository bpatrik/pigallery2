import {Pipe, PipeTransform} from '@angular/core';
import {MediaDTO, MediaDTOUtils} from '../../../common/entities/MediaDTO';
import {PhotoDTO} from '../../../common/entities/PhotoDTO';
import {MediaGroup} from '../ui/gallery/navigator/sorting.service';

@Pipe({
    name: 'photosOnly'
})
export class PhotoFilterPipe implements PipeTransform {
  transform(mediaGroups: MediaGroup[] | null | undefined): PhotoDTO[] {
    if (!mediaGroups) {
      return [];
    }
    const ret: PhotoDTO[] = [];
    for (const group of mediaGroups) {
      ret.push(...group.media.filter((m: MediaDTO): boolean =>
          MediaDTOUtils.isPhoto(m)
      ) as PhotoDTO[]);
    }
    return ret;
  }
}
