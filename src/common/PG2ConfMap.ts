import {SortByDirectionalTypes, SortByTypes, SortingMethod} from './entities/SortingMethods';
import {Utils} from './Utils';

/**
 * This contains the action of the supported list of *.pg2conf files.
 * These files are passed down to the client as metaFiles (like photos and directories)
 */
export const PG2ConfMap: { sorting: Record<string, SortingMethod>, upload: Record<string, boolean> } = {
  sorting: {},
  upload: {
    '.uploader.pg2conf': true
  }
};

Utils.enumToArray(SortByTypes).forEach(kv => {
  if (!Utils.isValidEnumInt(SortByDirectionalTypes, kv.key)) {
    PG2ConfMap.sorting['.order_random.pg2conf'] = {method: kv.key, ascending: null} as SortingMethod;
    return;
  }
  PG2ConfMap.sorting['.order_descending_' + kv.value.toLowerCase() + '.pg2conf'] = {method: kv.key, ascending: false} as SortingMethod;
  PG2ConfMap.sorting['.order_ascending_' + kv.value.toLowerCase() + '.pg2conf'] = {method: kv.key, ascending: true} as SortingMethod;
});

/**
 * These files are processed on the server side,
 * do not get passed down to the client or saved to the DB
 */

export enum ServerSidePG2ConfAction {
  // Enum always starts from 1 as !!0 === false
  SAVED_SEARCH = 1,
}

export const ServerPG2ConfMap: Record<string, ServerSidePG2ConfAction> = {
  '.saved_searches.pg2conf': ServerSidePG2ConfAction.SAVED_SEARCH,
};

