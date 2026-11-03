import {Pipe, PipeTransform} from '@angular/core';
import {DirectoryPathDTO} from '../../../common/entities/DirectoryDTO';
import {Utils} from '../../../common/Utils';

@Pipe({
  name: 'directoryPath'
})
export class DirectoryPathPipe implements PipeTransform {
  transform(directory: DirectoryPathDTO): string {
    return Utils.concatUrls(directory.path, directory.name);
  }
}
