import {UserDTO} from './UserDTO';

export interface SharingDTOKey {
  sharingKey: string;
}

export interface SharingDTO extends SharingDTOKey {
  id: number;
  path: string;
  sharingKey: string;
  password: string;
  expires: number;
  timeStamp: number;
  includeSubfolders: boolean;
  creator: UserDTO;
}

export interface CreateSharingDTO {
  id?: number;
  password: string;
  valid: number;
  includeSubfolders: boolean;
}
