import {Pipe, PipeTransform} from '@angular/core';

export const formatFileSize = (size: number): string => {
  const postFixes = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  while (size > 1000 && index < postFixes.length - 1) {
    size /= 1000;
    index++;
  }
  return size.toFixed(2) + postFixes[index];
};

@Pipe({
    name: 'fileSize'
})
export class FileSizePipe implements PipeTransform {
  transform(size: number): string {
    return formatFileSize(size);
  }
}

