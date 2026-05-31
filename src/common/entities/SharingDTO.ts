import {UserDTO} from './UserDTO';
import {SearchQueryDTO} from './SearchQueryDTO';

export interface SharingDTOKey {
  sharingKey: string;
  passwordProtected?: boolean;
}

export interface BaseSharingDTO extends SharingDTOKey {
  id: number;
  searchQuery: SearchQueryDTO;
  sharingKey: string;
  expires: number;
  timeStamp: number;
  creator?: UserDTO; // does not travel to client side
}


export interface ResponseSharingDTO extends BaseSharingDTO {
  id: number;
  searchQuery: SearchQueryDTO;
  sharingKey: string;
  expires: number;
  timeStamp: number;
  creator?: UserDTO; // does not travel to client side
  passwordProtected: boolean;
}

export interface UpdateSharingDTO extends BaseSharingDTO {
  id: number;
  searchQuery: SearchQueryDTO;
  sharingKey: string;
  password?: string;
  expires: number;
  timeStamp: number;
  creator?: UserDTO; // does not travel to client side
}

export interface CreateSharingDTO {
  id?: number;
  password: string;
  valid: number;
  searchQuery: SearchQueryDTO;
}
