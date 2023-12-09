import {Pipe, PipeTransform} from '@angular/core';
import {FileDTO} from '../../../common/entities/FileDTO';
import {MDFileDTO} from '../../../common/entities/MDFileDTO';

@Pipe({name: 'mdFiles'})
export class MDFilesFilterPipe implements PipeTransform {
  transform(metaFiles: FileDTO[]): MDFileDTO[] | null {
    if (!metaFiles) {
      return null;
    }
    return metaFiles.filter((f: FileDTO): boolean =>
        f.name.toLocaleLowerCase().endsWith('.md')
    ) as MDFileDTO[];
  }
}
