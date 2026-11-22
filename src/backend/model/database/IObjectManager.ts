import {DirectoryPathDTO} from '../../../common/entities/DirectoryDTO';

export interface IObjectManager {
  onNewDataVersion?: (changedDir?: DirectoryPathDTO) => Promise<void>;
  /**
   * Called once a day (see ObjectManagers.onDayChangeIfNeeded): caches of relative dates (date_pattern) go stale.
   */
  onNewDay?: () => Promise<void>;
  cleanUp?: () => Promise<void>;
  init?: () => Promise<void>;
}
