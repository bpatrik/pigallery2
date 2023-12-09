import {UserDTO} from './UserDTO';

export interface SharingDTO {
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
