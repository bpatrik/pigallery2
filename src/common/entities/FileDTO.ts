import {DirectoryPathDTO} from './DirectoryDTO';

export interface FileDTO {
  id: number;
  name: string;
  directory: DirectoryPathDTO;
}

