import {ParentDirectoryDTO} from '../../../common/entities/DirectoryDTO';

export interface IObjectManager {
  onNewDataVersion?: (changedDir?: ParentDirectoryDTO) => Promise<void>;
}
