import {Pipe, PipeTransform} from '@angular/core';
import {FileDTO} from '../../../common/entities/FileDTO';
import {Utils} from '../../../common/Utils';

@Pipe({name: 'toPath'})
export class FileDTOToPathPipe implements PipeTransform {
  transform(metaFile: FileDTO): string | null {
    if (!metaFile) {
      return null;
    }
    return Utils.concatUrls(
        'api/gallery/content/',
        metaFile.directory.path,
        metaFile.directory.name,
        metaFile.name
    );
  }
}
