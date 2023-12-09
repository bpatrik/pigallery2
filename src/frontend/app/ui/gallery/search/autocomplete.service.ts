import {Injectable} from '@angular/core';
import {NetworkService} from '../../../model/network/network.service';
import {IAutoCompleteItem} from '../../../../../common/entities/AutoCompleteItem';
import {GalleryCacheService} from '../cache.gallery.service';
import {SearchQueryParserService} from './search-query-parser.service';
import {BehaviorSubject} from 'rxjs';
import {SearchQueryTypes, TextSearchQueryTypes,} from '../../../../../common/entities/SearchQueryDTO';
import {QueryParams} from '../../../../../common/QueryParams';
import {SearchQueryParser} from '../../../../../common/SearchQueryParser';

@Injectable()
export class AutoCompleteService {
  private keywords: string[] = [];
  private textSearchKeywordsMap: { [key: string]: SearchQueryTypes } = {};
  private noACKeywordsMap: { [key: string]: SearchQueryTypes } = {}; // these commands do not have autocompete

  constructor(
      private networkService: NetworkService,
      private searchQueryParserService: SearchQueryParserService,
      private galleryCacheService: GalleryCacheService
  ) {
    this.keywords = Object.values(this.searchQueryParserService.keywords)
        .filter(
            (k) =>
                k !== this.searchQueryParserService.keywords.or &&
                k !== this.searchQueryParserService.keywords.and &&
                k !== this.searchQueryParserService.keywords.portrait &&
                k !== this.searchQueryParserService.keywords.kmFrom &&
                k !== this.searchQueryParserService.keywords.NSomeOf &&
                k !== this.searchQueryParserService.keywords.minRating &&
                k !== this.searchQueryParserService.keywords.maxRating &&
                k !== this.searchQueryParserService.keywords.minPersonCount &&
                k !== this.searchQueryParserService.keywords.maxPersonCount &&
                k !== this.searchQueryParserService.keywords.every_week &&
                k !== this.searchQueryParserService.keywords.every_month &&
                k !== this.searchQueryParserService.keywords.every_year &&
                k !== this.searchQueryParserService.keywords.weeks_ago &&
                k !== this.searchQueryParserService.keywords.days_ago &&
                k !== this.searchQueryParserService.keywords.months_ago &&
                k !== this.searchQueryParserService.keywords.years_ago &&
                k !== this.searchQueryParserService.keywords.lastNDays
        )
        .map((k) => k + ':');

    this.keywords.push(this.searchQueryParserService.keywords.and);
    this.keywords.push(this.searchQueryParserService.keywords.or);
    for (let i = 0; i < 5; i++) {
      this.keywords.push(
          i + '-' + this.searchQueryParserService.keywords.NSomeOf + ':( )'
      );
    }

    for (let i = 1; i < 3; i++) {
      this.keywords.push(
          this.searchQueryParserService.keywords.lastNDays.replace(/%d/g, i.toString()) + ':'
      );
    }

    this.keywords.push(
        this.searchQueryParserService.keywords.to +
        ':' +
        SearchQueryParser.stringifyText(new Date().getFullYear().toString())
    );
    this.keywords.push(
        this.searchQueryParserService.keywords.to +
        ':' +
        SearchQueryParser.stringifyText(
            SearchQueryParser.stringifyDate(Date.now())
        )
    );

    this.keywords.push(
        this.searchQueryParserService.keywords.from +
        ':' +
        SearchQueryParser.stringifyText(new Date().getFullYear().toString())
    );
    this.keywords.push(
        this.searchQueryParserService.keywords.from +
        ':' +
        SearchQueryParser.stringifyText(
            SearchQueryParser.stringifyDate(Date.now())
        )
    );

    TextSearchQueryTypes.forEach((t) => {
      this.textSearchKeywordsMap[
          (this.searchQueryParserService.keywords as any)[SearchQueryTypes[t]]
          ] = t;
    });

    this.noACKeywordsMap[this.searchQueryParserService.keywords.minRating]
        = SearchQueryTypes.min_rating;
    this.noACKeywordsMap[this.searchQueryParserService.keywords.maxRating]
        = SearchQueryTypes.max_rating;

    this.noACKeywordsMap[this.searchQueryParserService.keywords.minPersonCount]
        = SearchQueryTypes.min_person_count;
    this.noACKeywordsMap[this.searchQueryParserService.keywords.maxPersonCount]
        = SearchQueryTypes.max_person_count;

    this.noACKeywordsMap[this.searchQueryParserService.keywords.minResolution]
        = SearchQueryTypes.min_resolution;
    this.noACKeywordsMap[this.searchQueryParserService.keywords.maxResolution]
        = SearchQueryTypes.max_resolution;
  }

  public autoComplete(text: {
    current: string;
    prev: string;
  }): BehaviorSubject<RenderableAutoCompleteItem[]> {
    const items: BehaviorSubject<RenderableAutoCompleteItem[]> =
        new BehaviorSubject(
            this.sortResults(text.current, this.getQueryKeywords(text))
        );

    const prefixType = this.getTypeFromPrefix(text.current);
    const searchText = this.getPrefixLessSearchText(text.current);
    if (searchText === '' || searchText === '.' || prefixType.noAc) {
      return items;
    }

    this.typedAutoComplete(searchText, text.current, prefixType.type, items);
    return items;
  }

  private typedAutoComplete(
      text: string,
      fullText: string,
      type: SearchQueryTypes,
      items?: BehaviorSubject<RenderableAutoCompleteItem[]>
  ): BehaviorSubject<RenderableAutoCompleteItem[]> {
    items = items || new BehaviorSubject([]);

    const cached = this.galleryCacheService.getAutoComplete(text, type);
    try {
      if (cached == null) {
        const acParams: any = {};
        if (type) {
          acParams[QueryParams.gallery.search.type] = type;
        }
        this.networkService
            .getJson<IAutoCompleteItem[]>('/autocomplete/' + text, acParams)
            .then((ret) => {
              this.galleryCacheService.setAutoComplete(text, type, ret);
              items.next(
                  this.sortResults(
                      fullText,
                      ret
                          .map((i) => this.ACItemToRenderable(i, fullText))
                          .concat(items.value)
                  )
              );
            });
      } else {
        items.next(
            this.sortResults(
                fullText,
                cached
                    .map((i) => this.ACItemToRenderable(i, fullText))
                    .concat(items.value)
            )
        );
      }
    } catch (e) {
      console.error(e);
    }
    return items;
  }

  public getPrefixLessSearchText(text: string): string {
    const tokens = text.split(':');
    if (tokens.length !== 2) {
      return text;
    }
    // make sure autocomplete works for 'keyword:"' searches
    if (tokens[1].charAt(0) === '"' || tokens[1].charAt(0) === '(') {
      return tokens[1].substring(1);
    }
    return tokens[1];
  }

  /**
   * Returns with the type or tells no autocompete recommendations from the server
   * @param text
   * @private
   */
  private getTypeFromPrefix(text: string): { type?: SearchQueryTypes, noAc?: boolean } {
    const tokens = text.split(':');
    if (tokens.length !== 2) {
      return {type: null};
    }
    if (
        new RegExp('^\\d*-' + this.searchQueryParserService.keywords.kmFrom).test(
            tokens[0]
        )
    ) {
      return {type: SearchQueryTypes.distance};
    }
    if (this.noACKeywordsMap[tokens[0]]) {
      return {type: this.noACKeywordsMap[tokens[0]], noAc: true};
    }
    return {type: this.textSearchKeywordsMap[tokens[0]] || null};
  }

  private ACItemToRenderable(
      item: IAutoCompleteItem,
      searchToken: string
  ): RenderableAutoCompleteItem {
    if (!item.type) {
      return {text: item.text, queryHint: item.text};
    }
    if (
        (TextSearchQueryTypes.includes(item.type) ||
            item.type === SearchQueryTypes.distance) &&
        item.type !== SearchQueryTypes.any_text
    ) {
      let queryHint =
          (this.searchQueryParserService.keywords as any)[
              SearchQueryTypes[item.type]
              ] +
          ':"' +
          item.text +
          '"';

      // if its a distance search, change hint text
      const tokens = searchToken.split(':');
      if (
          tokens.length === 2 &&
          new RegExp(
              '^\\d*-' + this.searchQueryParserService.keywords.kmFrom
          ).test(tokens[0])
      ) {
        queryHint = tokens[0] + ':"' + item.text + '"';
      }

      return {
        text: item.text,
        type: item.type,
        queryHint,
      };
    }
    return {
      text: item.text,
      type: item.type,
      queryHint: item.text,
    };
  }

  private sortResults(
      text: string,
      items: RenderableAutoCompleteItem[]
  ): RenderableAutoCompleteItem[] {
    const textLC = text.toLowerCase();
    // Source: https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
    const isStartRgx = new RegExp('(\\s|^)' + textLC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return items.sort((a, b) => {
      const aLC = a.text.toLowerCase();
      const bLC = b.text.toLowerCase();

      const basicCompare = () => {
        // prioritize persons higher
        if (a.type !== b.type) {
          if (a.type === SearchQueryTypes.person) {
            return -1;
          } else if (b.type === SearchQueryTypes.person) {
            return 1;
          }
        }
        return aLC.localeCompare(bLC);
      };

      // both starts with the searched string
      if (aLC.startsWith(textLC) && bLC.startsWith(textLC)) {
        return basicCompare();

        // none starts with the searched string
      } else if (!aLC.startsWith(textLC) && !bLC.startsWith(textLC)) {

        if ((isStartRgx.test(aLC) && isStartRgx.test(bLC)) ||
            (!isStartRgx.test(aLC) && !isStartRgx.test(bLC))) {
          return basicCompare();
        } else if (isStartRgx.test(aLC)) {
          return -1;
        }
        return 1;
        // one of them starts with the searched string
      } else if (aLC.startsWith(textLC)) {
        return -1;
      }
      return 1;
    });
  }

  private getQueryKeywords(text: {
    current: string;
    prev: string;
  }): RenderableAutoCompleteItem[] {
    // if empty, recommend "and"
    if (text.current === '') {
      if (text.prev !== this.searchQueryParserService.keywords.and) {
        return [
          {
            text: this.searchQueryParserService.keywords.and,
            queryHint: this.searchQueryParserService.keywords.and,
            notSearchable: true,
          },
        ];
      } else {
        return [];
      }
    }
    const generateMatch = (key: string) => ({
      text: key,
      queryHint: key,
      notSearchable: true,
    });

    const ret = this.keywords
        .filter((key) => key.startsWith(text.current.toLowerCase()))
        .map(generateMatch);

    // make KmFrom sensitive to all positive distances
    const starterNum = parseInt(text.current);
    if (starterNum > 0) {
      const key = starterNum + '-' + this.searchQueryParserService.keywords.kmFrom + ':';
      if (key.startsWith(text.current.toLowerCase())) {
        ret.push(generateMatch(key));
      }
    }


    const addRangeAutoComp = (minStr: string, maxStr: string, minRange: number, maxRange: number) => {
      // only showing rating recommendations of the full query is typed
      const mrKey = minStr + ':';
      const mxrKey = maxStr + ':';
      if (text.current.toLowerCase().startsWith(mrKey)) {
        for (let i = minRange; i <= maxRange; ++i) {
          ret.push(generateMatch(mrKey + i));
        }
      } else if (mrKey.startsWith(text.current.toLowerCase())) {
        ret.push(generateMatch(mrKey));
      }


      if (text.current.toLowerCase().startsWith(mxrKey)) {
        for (let i = minRange; i <= maxRange; ++i) {
          ret.push(generateMatch(mxrKey + i));
        }
      } else if (mxrKey.startsWith(text.current.toLowerCase())) {
        ret.push(generateMatch(mxrKey));
      }
    };
    addRangeAutoComp(this.searchQueryParserService.keywords.minRating,
        this.searchQueryParserService.keywords.maxRating, 1, 5);
    addRangeAutoComp(this.searchQueryParserService.keywords.minPersonCount,
        this.searchQueryParserService.keywords.maxPersonCount, 0, 9);


    // Date patterns
    if (new RegExp('^' +
            SearchQueryParser.humanToRegexpStr(this.searchQueryParserService.keywords.lastNDays) + '!?:$', 'i')
            .test(text.current) ||
        new RegExp('^' + this.searchQueryParserService.keywords.sameDay + '!?:$', 'i')
            .test(text.current)) {
      ret.push(generateMatch(text.current + this.searchQueryParserService.keywords.every_week));
      ret.push(generateMatch(text.current + this.searchQueryParserService.keywords.every_month));
      ret.push(generateMatch(text.current + this.searchQueryParserService.keywords.every_year));

      ret.push(generateMatch(text.current + this.searchQueryParserService.keywords.days_ago.replace(/%d/g, '2')));
      ret.push(generateMatch(text.current + this.searchQueryParserService.keywords.weeks_ago.replace(/%d/g, '2')));
      ret.push(generateMatch(text.current + this.searchQueryParserService.keywords.months_ago.replace(/%d/g, '2')));
      ret.push(generateMatch(text.current + this.searchQueryParserService.keywords.years_ago.replace(/%d/g, '2')));

    }

    return ret;
  }
}

export interface RenderableAutoCompleteItem extends IAutoCompleteItem {
  queryHint: string;
  notSearchable?: boolean; // prevent triggering search if it is not a full search term
}
