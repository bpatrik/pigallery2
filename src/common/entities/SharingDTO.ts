import {UserDTO} from './UserDTO';
import {DirectorySearch, SearchQueryDTO} from './SearchQueryDTO';

interface SharingDTOKey {
  sharingKey: string;
}


export interface PublicSharingDTO extends SharingDTOKey {
  sharingKey: string;
  passwordProtected: boolean;
}

export interface BaseSharingDTO extends SharingDTOKey {
  id: number;
  defaultSearchView?: SearchQueryDTO;
  defaultDirectoryView?: string;
  searchQuery: SearchQueryDTO;
  directoryQuery?: DirectorySearch; // the directories that are available through the sharing
  sharingKey: string;
  expires: number;
  timeStamp: number;
  creator?: UserDTO; // does not travel to client side
}


export interface ResponseSharingDTO extends BaseSharingDTO, PublicSharingDTO {
  id: number;
  defaultSearchView?: SearchQueryDTO;
  defaultDirectoryView?: string;
  searchQuery: SearchQueryDTO;
  directoryQuery?: DirectorySearch; // the directories that are available through the sharing
  sharingKey: string;
  expires: number;
  timeStamp: number;
  creator?: UserDTO; // does not travel to client side
  passwordProtected: boolean;
}

export interface UpdateSharingDTO extends BaseSharingDTO {
  id: number;
  defaultSearchView?: SearchQueryDTO;
  defaultDirectoryView?: string;
  searchQuery: SearchQueryDTO;
  directoryQuery?: DirectorySearch; // the directories that are available through the sharing
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
  defaultSearchView?: SearchQueryDTO;
  defaultDirectoryView?: string;
  searchQuery: SearchQueryDTO;
  directoryQuery?: DirectorySearch; // the directories that are available through the sharing
}
