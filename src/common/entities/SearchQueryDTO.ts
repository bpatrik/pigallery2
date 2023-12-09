import {GPSMetadata} from './PhotoDTO';

export enum SearchQueryTypes {
  AND = 1,
  OR,
  SOME_OF,
  UNKNOWN_RELATION = 99999,

  // non-text metadata
  // |- range types
  from_date = 10,
  to_date,
  min_rating,
  max_rating,
  min_resolution,
  max_resolution,
  min_person_count,
  max_person_count,

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
export const MinRangeSearchQueryTypes = [
  SearchQueryTypes.from_date,
  SearchQueryTypes.min_rating,
  SearchQueryTypes.min_resolution,
];
export const MaxRangeSearchQueryTypes = [
  SearchQueryTypes.to_date,
  SearchQueryTypes.max_rating,
  SearchQueryTypes.max_resolution,
];

export const RangeSearchQueryTypes = MinRangeSearchQueryTypes.concat(
    MaxRangeSearchQueryTypes
);

export const MetadataSearchQueryTypes = [
  SearchQueryTypes.distance,
  SearchQueryTypes.orientation,
]
    .concat(RangeSearchQueryTypes)
    .concat(TextSearchQueryTypes);

export const rangedTypePairs: any = {};
rangedTypePairs[SearchQueryTypes.from_date] = SearchQueryTypes.to_date;
rangedTypePairs[SearchQueryTypes.min_rating] = SearchQueryTypes.max_rating;
rangedTypePairs[SearchQueryTypes.min_resolution] =
    SearchQueryTypes.max_resolution;
// add the other direction too
for (const key of Object.keys(rangedTypePairs)) {
  rangedTypePairs[rangedTypePairs[key]] = key;
}

export enum TextSearchQueryMatchTypes {
  exact_match = 1,
  like = 2,
}

export const SearchQueryDTOUtils = {
  getRangedQueryPair: (type: SearchQueryTypes): SearchQueryTypes => {
    if (rangedTypePairs[type]) {
      return rangedTypePairs[type];
    }
    throw new Error('Unknown ranged type');
  },
  negate: (query: SearchQueryDTO): SearchQueryDTO => {
    switch (query.type) {
      case SearchQueryTypes.AND:
        query.type = SearchQueryTypes.OR;
        (query as SearchListQuery).list = (query as SearchListQuery).list.map(
            (q) => SearchQueryDTOUtils.negate(q)
        );
        return query;
      case SearchQueryTypes.OR:
        query.type = SearchQueryTypes.AND;
        (query as SearchListQuery).list = (query as SearchListQuery).list.map(
            (q) => SearchQueryDTOUtils.negate(q)
        );
        return query;

      case SearchQueryTypes.orientation:
        (query as OrientationSearch).landscape = !(query as OrientationSearch)
            .landscape;
        return query;

      case SearchQueryTypes.from_date:
      case SearchQueryTypes.to_date:
      case SearchQueryTypes.min_rating:
      case SearchQueryTypes.max_rating:
      case SearchQueryTypes.min_resolution:
      case SearchQueryTypes.max_resolution:
      case SearchQueryTypes.distance:
      case SearchQueryTypes.any_text:
      case SearchQueryTypes.person:
      case SearchQueryTypes.position:
      case SearchQueryTypes.keyword:
      case SearchQueryTypes.caption:
      case SearchQueryTypes.file_name:
      case SearchQueryTypes.directory:
        (query as NegatableSearchQuery).negate = !(
            query as NegatableSearchQuery
        ).negate;
        return query;

      case SearchQueryTypes.SOME_OF:
        throw new Error('Some of not supported');

      default:
        throw new Error('Unknown type' + query.type);
    }
  },
};

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
  min?: number; // at least this amount of items
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
  text: string;
}

export interface DistanceSearch extends NegatableSearchQuery {
  type: SearchQueryTypes.distance;
  from: {
    text?: string;
    GPSData?: GPSMetadata;
  };
  distance: number; // in kms
}

export interface RangeSearch extends NegatableSearchQuery {
  value: number;
}

export interface FromDateSearch extends RangeSearch {
  type: SearchQueryTypes.from_date;
  value: number;
}

export interface ToDateSearch extends RangeSearch {
  type: SearchQueryTypes.to_date;
  value: number;
}

export interface MinRatingSearch extends RangeSearch {
  type: SearchQueryTypes.min_rating;
  value: number;
}

export interface MaxRatingSearch extends RangeSearch {
  type: SearchQueryTypes.max_rating;
  value: number;
}


export interface MinPersonCountSearch extends RangeSearch {
  type: SearchQueryTypes.min_person_count;
  value: number;
}

export interface MaxPersonCountSearch extends RangeSearch {
  type: SearchQueryTypes.max_person_count;
  value: number;
}

export interface MinResolutionSearch extends RangeSearch {
  type: SearchQueryTypes.min_resolution;
  value: number; // in megapixels
}

export interface MaxResolutionSearch extends RangeSearch {
  type: SearchQueryTypes.max_resolution;
  value: number; // in megapixels
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

