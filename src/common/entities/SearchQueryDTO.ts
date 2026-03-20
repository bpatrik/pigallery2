import {GPSMetadata} from './PhotoDTO';

export enum SearchQueryTypes {
  AND = 1,
  OR,
  SOME_OF,
  UNKNOWN_RELATION = 99999,

  // non-text metadata
  // |- range types
  date = 10,
  rating = 12,
  resolution = 14,
  person_count = 16,

  distance = 50,
  orientation,


  date_pattern = 60,

  // TEXT search types
  any_text = 100,
  caption,
  directory,
  file_name,
  keyword,
  person,
  position,


}

export const ListSearchQueryTypes = [
  SearchQueryTypes.AND,
  SearchQueryTypes.OR,
  SearchQueryTypes.SOME_OF,
];
export const TextSearchQueryTypes = [
  SearchQueryTypes.any_text,
  SearchQueryTypes.caption,
  SearchQueryTypes.directory,
  SearchQueryTypes.file_name,
  SearchQueryTypes.keyword,
  SearchQueryTypes.person,
  SearchQueryTypes.position,
];
export const RangeSearchQueryTypes = [
  SearchQueryTypes.date,
  SearchQueryTypes.rating,
  SearchQueryTypes.resolution,
  SearchQueryTypes.person_count,
];


export const MetadataSearchQueryTypes = [
  SearchQueryTypes.distance,
  SearchQueryTypes.orientation,
]
  .concat(RangeSearchQueryTypes)
  .concat(TextSearchQueryTypes);


export enum TextSearchQueryMatchTypes {
  exact_match = 1,
  like = 2, // default value
}

export interface SearchQueryDTO {
  type: SearchQueryTypes;
}

export interface NegatableSearchQuery extends SearchQueryDTO {
  negate?: boolean; // if true negates the expression
}

export interface SearchListQuery extends SearchQueryDTO {
  list: SearchQueryDTO[];
}

export interface ANDSearchQuery extends SearchQueryDTO, SearchListQuery {
  type: SearchQueryTypes.AND;
  list: SearchQueryDTO[];
}

export interface ORSearchQuery extends SearchQueryDTO, SearchListQuery {
  type: SearchQueryTypes.OR;
  list: SearchQueryDTO[];
}

export interface SomeOfSearchQuery extends SearchQueryDTO, SearchListQuery {
  type: SearchQueryTypes.SOME_OF;
  list: NegatableSearchQuery[];
  min?: number; // at least this number of items
}

export interface TextSearch extends NegatableSearchQuery {
  type:
    | SearchQueryTypes.any_text
    | SearchQueryTypes.person
    | SearchQueryTypes.keyword
    | SearchQueryTypes.position
    | SearchQueryTypes.caption
    | SearchQueryTypes.file_name
    | SearchQueryTypes.directory;
  matchType?: TextSearchQueryMatchTypes;
  value: string;
}

export interface DistanceSearch extends NegatableSearchQuery {
  type: SearchQueryTypes.distance;
  from: {
    value?: string;
    GPSData?: GPSMetadata;
  };
  distance: number; // in kms
}

export interface RangeSearch extends NegatableSearchQuery {
  min?: number;
  max?: number;
}

export interface DateSearch extends RangeSearch {
  type: SearchQueryTypes.date;
  min?: number;
  max?: number;
}


export interface RatingSearch extends RangeSearch {
  type: SearchQueryTypes.rating;
  min?: number;
  max?: number;
}


export interface PersonCountSearch extends RangeSearch {
  type: SearchQueryTypes.person_count;
  min?: number;
  max?: number;
}


export interface ResolutionSearch extends RangeSearch {
  type: SearchQueryTypes.resolution;
  min?: number;
  max?: number; // in megapixels
}


export interface OrientationSearch {
  type: SearchQueryTypes.orientation;
  landscape: boolean;
}

export enum DatePatternFrequency {
  every_week = 1, every_month, every_year,
  days_ago = 10, weeks_ago, months_ago, years_ago
}

export interface DatePatternSearch extends NegatableSearchQuery {
  type: SearchQueryTypes.date_pattern;
  daysLength: number; // days
  frequency: DatePatternFrequency;
  agoNumber?: number;
  negate?: boolean;
}

