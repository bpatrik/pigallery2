import {Injectable} from '@angular/core';
import {QueryKeywords, SearchQueryParser,} from '../../../../../common/SearchQueryParser';
import {SearchQueryDTO} from '../../../../../common/entities/SearchQueryDTO';

@Injectable()
export class SearchQueryParserService {
  public readonly keywords: QueryKeywords = {
    NSomeOf: 'of',
    and: 'and',
    or: 'or',

    from: 'after',
    to: 'before',
    landscape: 'landscape',
    maxRating: 'max-rating',
    minRating: 'min-rating',
    minPersonCount: 'min-faces',
    maxPersonCount: 'max-faces',
    maxResolution: 'max-resolution',
    minResolution: 'min-resolution',
    orientation: 'orientation',

    years_ago: '%d-years-ago',
    months_ago: '%d-months-ago',
    weeks_ago: '%d-weeks-ago',
    days_ago: '%d-days-ago',
    every_year: 'every-year',
    every_month: 'every-month',
    every_week: 'every-week',
    lastNDays: 'last-%d-days',
    sameDay: 'same-day',

    any_text: 'any-text',
    keyword: 'keyword',
    caption: 'caption',
    directory: 'directory',
    file_name: 'file-name',
    person: 'person',
    portrait: 'portrait',
    position: 'position',
    someOf: 'some-of',
    kmFrom: 'km-from',
  };
  private readonly parser: SearchQueryParser;

  constructor() {
    this.parser = new SearchQueryParser(this.keywords);
  }

  public parse(str: string): SearchQueryDTO {
    return this.parser.parse(str);
  }

  stringify(query: SearchQueryDTO): string {
    return this.parser.stringify(query);
  }
}
