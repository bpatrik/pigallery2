import {Brackets} from 'typeorm';
import {UserDTO} from '../../common/entities/UserDTO';
import {DirectorySearch, SearchQueryDTO} from '../../common/entities/SearchQueryDTO';
import {DirectoryAccess} from './DirectoryAccess';

export class SessionContext {
  user: SessionUser;
  // New structured projection with prebuilt SQL and params
  // It also contains the directory allow/block list, so media in a not available directory is filtered out
  projectionQuery?: Brackets;
  hasDirectoryProjection: boolean;
  // Which directories the session can open (directory allow / block lists). No restriction by default.
  directoryAccess: DirectoryAccess = new DirectoryAccess(this);
}

export interface SessionUser extends UserDTO {
  overrideAllowBlockList?: boolean;

  allowQuery?: SearchQueryDTO;

  blockQuery?: SearchQueryDTO;

  allowDirectoryList?: DirectorySearch[];

  blockDirectoryList?: DirectorySearch[];

  // Only used for sharing users: the directories that are available through the sharing (works as a directory allow list).
  // If not set, only directories with visible photos are available.
  sharingDirectoryQuery?: DirectorySearch;
}
