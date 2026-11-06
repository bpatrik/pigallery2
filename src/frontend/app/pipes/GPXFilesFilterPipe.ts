import {Pipe, PipeTransform} from '@angular/core';
import {FileDTO} from '../../../common/entities/FileDTO';
import {Config} from '../../../common/config/public/Config';

export const filterGPXFiles = (metaFiles: FileDTO[] | null | undefined): FileDTO[] => {
  if (!Config.MetaFile.gpx || !metaFiles) {
    return [];
  }
  return metaFiles.filter((f: FileDTO): boolean =>
    f.name.toLocaleLowerCase().endsWith('.gpx')
  );
};

@Pipe({
    name: 'gpxFiles'
})
export class GPXFilesFilterPipe implements PipeTransform {
  transform(metaFiles: FileDTO[] | null | undefined): FileDTO[] {
    return filterGPXFiles(metaFiles);
  }
}
