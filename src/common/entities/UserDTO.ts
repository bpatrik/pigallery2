import {DirectorySearch, SearchQueryDTO} from './SearchQueryDTO';

export enum UserRoles {
  LimitedGuest = 1, // sharing user
  Guest = 2,  // read-only user: can browse and search, but cannot share, see albums, etc.
  User = 3, // logged in use
  Admin = 4,
  Developer = 5, // admin with more client side logging
}

export interface UserDTO {
  id: number;
  name: string;
  password?: string;
  role: UserRoles;
  oidcSubject?: string | null; // set if the user is linked to an OIDC account (strict security mode)
  usedSharingKey?: string;
  projectionKey?: string; // allow- and blocklist projection hash. if null, no projection
  // Optional per-user query overrides
  overrideAllowBlockList?: boolean;
  allowQuery?: SearchQueryDTO | null;
  blockQuery?: SearchQueryDTO | null;
  allowDirectoryList?: DirectorySearch[] | null;
  blockDirectoryList?: DirectorySearch[] | null;
}
