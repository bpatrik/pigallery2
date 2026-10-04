import {MediaDTO} from './MediaDTO';

export interface TimelinePageDTO {
  media: MediaDTO[];
  next: {from: number; after: number} | null;
}

export interface TimelineSummaryMonthDTO {
  month: number;
  count: number;
}

export interface TimelineSummaryYearDTO {
  year: number;
  months: TimelineSummaryMonthDTO[];
}

export interface TimelineSummaryDTO {
  years: TimelineSummaryYearDTO[];
}