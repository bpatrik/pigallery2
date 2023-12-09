import {Pipe, PipeTransform} from '@angular/core';
import {FileDTO} from '../../../common/entities/FileDTO';
import {Config} from '../../../common/config/public/Config';

@Pipe({name: 'gpxFiles'})
export class GPXFilesFilterPipe implements PipeTransform {
  transform(metaFiles: FileDTO[]): FileDTO[] | null {
    if (!Config.MetaFile.gpx) {
      return [];
    }
    if (!metaFiles) {
      return null;
    }
    return metaFiles.filter((f: FileDTO): boolean =>
        f.name.toLocaleLowerCase().endsWith('.gpx')
    );
  }
}
