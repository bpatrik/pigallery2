import {Injectable} from '@angular/core';
import {NetworkService} from '../../../model/network/network.service';
import {type IAutoCompleteItem} from '../../../../../common/entities/AutoCompleteItem';
import {GalleryCacheService} from '../cache.gallery.service';
import {SearchQueryParserService} from './search-query-parser.service';
import {BehaviorSubject} from 'rxjs';
import {SearchQueryTypes, TextSearchQueryTypes,} from '../../../../../common/entities/SearchQueryDTO';
import {QueryParams} from '../../../../../common/QueryParams';
import {defaultQueryKeywords, SearchQueryParser} from '../../../../../common/SearchQueryParser';

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
    this.keywords = Object.values(defaultQueryKeywords)
      .filter(
        (k) =>
          k !== defaultQueryKeywords.or &&
          k !== defaultQueryKeywords.and &&
          k !== defaultQueryKeywords.portrait &&
          k !== defaultQueryKeywords.kmFrom &&
          k !== defaultQueryKeywords.NSomeOf &&
          k !== defaultQueryKeywords.rating &&
          k !== defaultQueryKeywords.resolution &&
          k !== defaultQueryKeywords.personCount &&
          k !== defaultQueryKeywords.every_week &&
          k !== defaultQueryKeywords.every_month &&
          k !== defaultQueryKeywords.every_year &&
          k !== defaultQueryKeywords.weeks_ago &&
          k !== defaultQueryKeywords.days_ago &&
          k !== defaultQueryKeywords.months_ago &&
          k !== defaultQueryKeywords.years_ago &&
          k !== defaultQueryKeywords.lastNDays
      )
      .map((k) => k + ':');

    this.keywords.push(defaultQueryKeywords.and);
    this.keywords.push(defaultQueryKeywords.or);
    for (let i = 0; i < 5; i++) {
      this.keywords.push(
        i + '-' + defaultQueryKeywords.NSomeOf + ':( )'
      );
    }

    for (let i = 1; i < 3; i++) {
      this.keywords.push(
        defaultQueryKeywords.lastNDays.replace(/%d/g, i.toString()) + ':'
      );
    }

    this.keywords.push(
      defaultQueryKeywords.date +
      '<=' +
      SearchQueryParser.stringifyText(new Date().getFullYear().toString())
    );
    this.keywords.push(
      defaultQueryKeywords.date +
      '<=' +
      SearchQueryParser.stringifyText(
        SearchQueryParser.stringifyDate(Date.now())
      )
    );

    this.keywords.push(
      defaultQueryKeywords.date +
      '>=' +
      SearchQueryParser.stringifyText(new Date().getFullYear().toString())
    );
    this.keywords.push(
      defaultQueryKeywords.date +
      '>=' +
      SearchQueryParser.stringifyText(
        SearchQueryParser.stringifyDate(Date.now())
      )
    );
    this.keywords.push(
      defaultQueryKeywords.date +
      ':' +
      SearchQueryParser.stringifyText((new Date().getFullYear() - 1).toString()) +
      '..' +
      SearchQueryParser.stringifyText(new Date().getFullYear().toString())
    );


    this.keywords.push(
      defaultQueryKeywords.date +
      ':' +
      SearchQueryParser.stringifyText(SearchQueryParser.stringifyDate(Date.now() - 60 * 60 * 24 * 1000 * 365)) +
      '..' +
      SearchQueryParser.stringifyText(SearchQueryParser.stringifyDate(Date.now()))
    );

    TextSearchQueryTypes.forEach((t) => {
      this.textSearchKeywordsMap[
        (defaultQueryKeywords as any)[SearchQueryTypes[t]]
        ] = t;
    });

    this.noACKeywordsMap[defaultQueryKeywords.rating]
      = SearchQueryTypes.rating;

    this.noACKeywordsMap[defaultQueryKeywords.personCount]
      = SearchQueryTypes.person_count;

    this.noACKeywordsMap[defaultQueryKeywords.resolution]
      = SearchQueryTypes.resolution;
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
          .getJson<IAutoCompleteItem[]>('/autocomplete/' + encodeURIComponent(text), acParams)
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
      new RegExp('^\\d*-' + defaultQueryKeywords.kmFrom).test(
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
      return {value: item.value, queryHint: item.value};
    }
    if (
      (TextSearchQueryTypes.includes(item.type) ||
        item.type === SearchQueryTypes.distance) &&
      item.type !== SearchQueryTypes.any_text
    ) {
      let queryHint =
        (defaultQueryKeywords as any)[
          SearchQueryTypes[item.type]
          ] +
        ':"' +
        item.value +
        '"';

      // if its a distance search, change hint text
      const tokens = searchToken.split(':');
      if (
        tokens.length === 2 &&
        new RegExp(
          '^\\d*-' + defaultQueryKeywords.kmFrom
        ).test(tokens[0])
      ) {
        queryHint = tokens[0] + ':"' + item.value + '"';
      }

      return {
        value: item.value,
        type: item.type,
        queryHint,
      };
    }
    return {
      value: item.value,
      type: item.type,
      queryHint: item.value,
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
      const aLC = a.value.toLowerCase();
      const bLC = b.value.toLowerCase();

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
      if (text.prev !== defaultQueryKeywords.and) {
        return [
          {
            value: defaultQueryKeywords.and,
            queryHint: defaultQueryKeywords.and,
            notSearchable: true,
          },
        ];
      } else {
        return [];
      }
    }
    const generateMatch = (key: string, hint?: string): RenderableAutoCompleteItem => ({
      value: key,
      queryHint: hint ?? key,
      notSearchable: true,
    });


    const ret: Record<string, RenderableAutoCompleteItem> = {};

    const addItem = (item: RenderableAutoCompleteItem) => {
      ret[JSON.stringify(item)] = item;
    };

    this.keywords
      .filter((key) => key.startsWith(text.current.toLowerCase()))
      .map(v => generateMatch(v)).forEach(addItem);

    // make KmFrom sensitive to all positive distances
    const starterNum = parseInt(text.current);
    if (starterNum > 0) {
      const key = starterNum + '-' + defaultQueryKeywords.kmFrom + ':';
      if (key.startsWith(text.current.toLowerCase())) {
        addItem(generateMatch(key));
      }
    }


    const addRangeAutoComp = (kw: string, minRange: number, maxRange: number) => {
      const textLC = text.current.toLowerCase();
      const operators = ['>=', '>', '<', '<=', '=', ':'];

      for (const op of operators) {
        if (textLC.startsWith(kw + op)) {
          for (let i = minRange; i <= maxRange; ++i) {
            addItem(generateMatch(kw + op + i));
          }
          if (op === ':') {
            addItem(generateMatch(kw + ':' + minRange + '..' + maxRange));
          }
          return;
        }
      }

      if (kw.startsWith(textLC)) {
        addItem(generateMatch(kw + '<=' + maxRange));
        addItem(generateMatch(kw + '=' + Math.floor((minRange + maxRange) / 2)));
        addItem(generateMatch(kw + '>=' + minRange));
        addItem(generateMatch(kw + ':' + minRange + '..' + maxRange));
      }
    };
    addRangeAutoComp(defaultQueryKeywords.rating, 1, 5);
    addRangeAutoComp(defaultQueryKeywords.personCount, 0, 9);


    // Date patterns
    if (new RegExp('^' +
        SearchQueryParser.humanToRegexpStr(defaultQueryKeywords.lastNDays) + '!?:$', 'i')
        .test(text.current) ||
      new RegExp('^' + defaultQueryKeywords.sameDay + '!?:$', 'i')
        .test(text.current)) {
      addItem(generateMatch(text.current + defaultQueryKeywords.every_week));
      addItem(generateMatch(text.current + defaultQueryKeywords.every_month));
      addItem(generateMatch(text.current + defaultQueryKeywords.every_year));

      addItem(generateMatch(text.current + defaultQueryKeywords.days_ago.replace(/%d/g, '2')));
      addItem(generateMatch(text.current + defaultQueryKeywords.weeks_ago.replace(/%d/g, '2')));
      addItem(generateMatch(text.current + defaultQueryKeywords.months_ago.replace(/%d/g, '2')));
      addItem(generateMatch(text.current + defaultQueryKeywords.years_ago.replace(/%d/g, '2')));

    }

    return Object.values(ret);
  }
}

export interface RenderableAutoCompleteItem extends IAutoCompleteItem {
  queryHint: string;
  notSearchable?: boolean; // prevent triggering search if it is not a full search term
}
