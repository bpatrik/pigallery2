import {UserDTO} from './UserDTO';
import {SearchQueryDTO} from './SearchQueryDTO';

export interface SharingDTOKey {
  sharingKey: string;
}

export interface SharingDTO extends SharingDTOKey {
  id: number;
  searchQuery: SearchQueryDTO;
  sharingKey: string;
  password: string;
  expires: number;
  timeStamp: number;
  creator: UserDTO;
}

export interface CreateSharingDTO {
  id?: number;
  password: string;
  valid: number;
}
