import {Pipe, type PipeTransform} from '@angular/core';
import {type FileDTO} from '../../../common/entities/FileDTO';
import {Utils} from '../../../common/Utils';

@Pipe({
    name: 'toRelativePath',
    standalone: true
})
export class FileDTOToRelativePathPipe implements PipeTransform {
  transform(metaFile: FileDTO): string | null {
    if (!metaFile) {
      return null;
    }
    return Utils.concatUrls(
        metaFile.directory.path,
        metaFile.directory.name,
        metaFile.name
    );
  }
}
