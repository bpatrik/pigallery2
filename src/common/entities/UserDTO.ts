import {DirectorySearch, SearchQueryDTO} from './SearchQueryDTO';

export enum UserRoles {
  LimitedGuest = 1, // sharing user
  Guest = 2,  // user when authentication is disabled
  User = 3, // logged in use
  Admin = 4,
  Developer = 5, // admin with more client side logging
}

export interface UserDTO {
  id: number;
  name: string;
  password?: string;
  role: UserRoles;
  usedSharingKey?: string;
  projectionKey?: string; // allow- and blocklist projection hash. if null, no projection
  // Optional per-user query overrides
  overrideAllowBlockList?: boolean;
  allowQuery?: SearchQueryDTO | null;
  blockQuery?: SearchQueryDTO | null;
  allowDirectoryList?: DirectorySearch[] | null;
  blockDirectoryList?: DirectorySearch[] | null;
}
