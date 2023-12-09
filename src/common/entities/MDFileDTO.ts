import {DirectoryPathDTO} from './DirectoryDTO';
import {FileDTO} from './FileDTO';

export interface MDFileDTO extends FileDTO {
  id: number;
  name: string;
  directory: DirectoryPathDTO;
  date: number;
}

