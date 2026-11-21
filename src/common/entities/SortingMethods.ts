/**
 * Warning: Enum Values in this file should be unique within the file!
 * */

/**
 * FaceSortByTypes is a subset of SortByDirectionalTypes, their values should match.
 * They are not merged programatically due to the ordering issue.
 */
export enum FaceSortByTypes {
  Name = 10,
  PersonCount = 40,
}

export enum SortByDirectionalTypes {
  Name = 10,
  Date = 20,
  Rating = 30,
  PersonCount = 40,
  FileSize = 50,
  Directory = 60,
}

// These cant be set asc or desc
export enum SortByBasicTypes {
  Random = 100
}

// These cant be set asc or desc
export enum GroupByBasicTypes {
  NoGrouping = 200
}

/**
 * Order of these enums determines the order in the UI.
 * Keep spaces between the values, so new value can be added in between without changing the existing ones
 */
export const SortByTypes = {
  ...SortByDirectionalTypes,
  ...SortByBasicTypes
};

export const GroupByTypes = {
  ...SortByDirectionalTypes,
  ...GroupByBasicTypes
};

/**
 * All media of a directory are in the same directory, so sorting or grouping it by directory is meaningless:
 * only search results (incl. albums and flattened directories) can use SortByTypes.Directory.
 */
const withoutDirectory = <T extends object>(types: T): Omit<T, 'Directory'> => {
  const ret = {...types} as Record<string | number, unknown>;
  delete ret['Directory'];
  delete ret[SortByDirectionalTypes.Directory];
  return ret as Omit<T, 'Directory'>;
};
export const DirectorySortByTypes = withoutDirectory(SortByTypes);
export const DirectoryGroupByTypes = withoutDirectory(GroupByTypes);

export const GroupSortByTypes = {
  ...SortByDirectionalTypes,
  ...SortByBasicTypes,
  ...GroupByBasicTypes
};


export interface SortingMethod {
  method: SortByDirectionalTypes | SortByBasicTypes;
  ascending: boolean | null; // null: the method has no direction (e.g. random)
}

export interface GroupingMethod {
  method: SortByDirectionalTypes | GroupByBasicTypes;
  ascending: boolean;
}

