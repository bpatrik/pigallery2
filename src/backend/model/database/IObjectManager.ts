import {DirectoryPathDTO} from '../../../common/entities/DirectoryDTO';

export interface IObjectManager {
  onNewDataVersion?: (changedDir?: DirectoryPathDTO) => Promise<void>;
  cleanUp?: () => Promise<void>;
  init?: () => Promise<void>;
}
