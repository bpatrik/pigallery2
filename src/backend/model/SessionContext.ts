import {Brackets} from 'typeorm';
import {UserDTO} from '../../common/entities/UserDTO';
import {SearchQueryDTO} from '../../common/entities/SearchQueryDTO';

export class SessionContext {
  user: ContextUser;
  // New structured projection with prebuilt SQL and params
  projectionQuery?: Brackets;
  projectionQueryForSubDir?: Brackets; // only the directory part of the query, where it filters 'directories' instead of 'directory' aliases
  hasDirectoryProjection: boolean;
  // projection depends on the current date (date patterns), so its results change without new data
  hasTimeDependentProjection?: boolean;
}

export interface ContextUser extends UserDTO {
  overrideAllowBlockList?: boolean;

  allowQuery?: SearchQueryDTO;

  blockQuery?: SearchQueryDTO;
}
