import {Injectable} from '@angular/core';
import {SearchQueryParser} from '../../../../../common/SearchQueryParser';
import {SearchQueryDTO} from '../../../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';

@Injectable()
export class SearchQueryParserService {
  private readonly parser: SearchQueryParser;

  constructor() {
    this.parser = new SearchQueryParser();
  }

  public parse(str: string): SearchQueryDTO {
    return this.parser.parse(str);
  }

  stringify(query: SearchQueryDTO): string {
    return this.parser.stringify(SearchQueryUtils.stripDefault(query));
  }
}
