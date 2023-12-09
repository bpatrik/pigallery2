/**
 * Warning: Enum Values in this file should be unique within the file!
 * */

export enum SortByDirectionalTypes {
  Name = 10,
  Date = 20,
  Rating = 30,
  PersonCount = 40,
  FileSize = 50,
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
export const GroupSortByTypes = {
  ...SortByDirectionalTypes,
  ...SortByBasicTypes,
  ...GroupByBasicTypes
};


export interface SortingMethod {
  method: SortByDirectionalTypes | SortByBasicTypes;
  ascending: boolean;
}

export interface GroupingMethod {
  method: SortByDirectionalTypes | GroupByBasicTypes;
  ascending: boolean;
}

