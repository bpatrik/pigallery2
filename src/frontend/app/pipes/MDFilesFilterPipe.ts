import {Pipe, type PipeTransform} from '@angular/core';
import {type FileDTO} from '../../../common/entities/FileDTO';
import {type MDFileDTO} from '../../../common/entities/MDFileDTO';

@Pipe({
    name: 'mdFiles',
    standalone: true
})
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
