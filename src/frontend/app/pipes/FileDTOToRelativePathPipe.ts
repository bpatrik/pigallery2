import {Pipe, PipeTransform} from '@angular/core';
import {FileDTO} from '../../../common/entities/FileDTO';
import {Utils} from '../../../common/Utils';

@Pipe({name: 'toRelativePath'})
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
