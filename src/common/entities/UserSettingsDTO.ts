import {DirectorySearch, SearchQueryDTO} from './SearchQueryDTO';

export interface UserSettingsDTO {
  newPassword?: string;
  overrideAllowBlockList?: boolean;
  allowQuery?: SearchQueryDTO | null;
  blockQuery?: SearchQueryDTO | null;
  allowDirectoryList?: DirectorySearch[] | null;
  blockDirectoryList?: DirectorySearch[] | null;
}
