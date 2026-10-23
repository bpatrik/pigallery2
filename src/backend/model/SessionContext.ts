import {Brackets} from 'typeorm';
import {UserDTO} from '../../common/entities/UserDTO';
import {DirectorySearch, SearchQueryDTO} from '../../common/entities/SearchQueryDTO';
import {DirectoryAccess} from './DirectoryAccess';

export class SessionContext {
  user: ContextUser;
  // New structured projection with prebuilt SQL and params
  // It also contains the directory allow/block list, so media in a not available directory is filtered out
  projectionQuery?: Brackets;
  projectionQueryForSubDir?: Brackets; // only the directory part of the media query, where it filters 'directories' instead of 'directory' aliases
  hasDirectoryProjection: boolean;
  // Which directories the session can open (directory allow / block lists). No restriction by default.
  directoryAccess: DirectoryAccess = new DirectoryAccess(this);
}

export interface ContextUser extends UserDTO {
  overrideAllowBlockList?: boolean;

  allowQuery?: SearchQueryDTO;

  blockQuery?: SearchQueryDTO;

  allowDirectoryList?: DirectorySearch[];

  blockDirectoryList?: DirectorySearch[];

  // Only used for sharing users: the directories that are available through the sharing (works as a directory allow list).
  // If not set, only directories with visible photos are available.
  sharingDirectoryQuery?: DirectorySearch;
}
