import {expect} from 'chai';
import {
  ANDSearchQuery,
  DatePatternFrequency,
  DatePatternSearch,
  DateSearch,
  DistanceSearch,
  OrientationSearch,
  ORSearchQuery,
  PersonCountSearch,
  RangeSearch,
  RatingSearch,
  ResolutionSearch,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes
} from '../../../src/common/entities/SearchQueryDTO';
import {defaultQueryKeywords, SearchQueryParser} from '../../../src/common/SearchQueryParser';


describe('SearchQueryParser', () => {

  const check = (query: SearchQueryDTO) => {
    const parser = new SearchQueryParser(defaultQueryKeywords);
    expect(parser.parse(parser.stringify(query))).to.deep.equals(query, parser.stringify(query));
  };

  const reverseCheck = (query: string) => {
    const parser = new SearchQueryParser(defaultQueryKeywords);
    expect(parser.stringify(parser.parse(query))).to.deep.equals(query);
  };
  const equalCheck = (q1: string, q2: string) => {
    const parser = new SearchQueryParser(defaultQueryKeywords);
    expect(parser.stringify(parser.parse(q1))).to.deep.equals(parser.stringify(parser.parse(q2)));
  };


  describe('should deserialize', () => {


    it('Text search', () => {
      const parser = new SearchQueryParser(defaultQueryKeywords);
      expect(parser.parse('some_text')).to.deep.equals(
        {
          type: SearchQueryTypes.any_text,
          value: 'some_text'
        } as TextSearch);
      expect(parser.parse('any-text:(some text)')).to.deep.equals(
        {
          type: SearchQueryTypes.any_text,
          value: 'some text'
        } as TextSearch);
      expect(parser.parse('any-text:(some_text)')).to.deep.equals(
        {
          type: SearchQueryTypes.any_text,
          value: 'some_text'
        } as TextSearch);
    });
  });
  describe('should serialize', () => {


    it('Text search', () => {
      const parser = new SearchQueryParser(defaultQueryKeywords);
      expect(parser.stringify({
        type: SearchQueryTypes.any_text,
        value: 'some_text'
      } as TextSearch)).to.deep.equals('some_text');
      expect(parser.stringify({
        type: SearchQueryTypes.any_text,
        value: 'some text'
      } as TextSearch)).to.deep.equals('any-text:(some text)');
      expect(parser.stringify({
        type: SearchQueryTypes.any_text,
        value: 'some text',
        matchType: TextSearchQueryMatchTypes.exact_match
      } as TextSearch)).to.deep.equals('any-text:"some text"');
    });
  });
  describe('should serialize and deserialize', () => {

    it('Text search', () => {
      reverseCheck('some_text');

      reverseCheck('any-text:(some text)');
      reverseCheck('any-text:"some text"');

      // directories
      reverseCheck('directory:(some text)');
      reverseCheck('directory:"some text"');
      reverseCheck('directory!:(some text)');
      reverseCheck('directory!:"some text"');
      reverseCheck('directory~:"some text"');
      reverseCheck('directory!~:"some text"');
      reverseCheck('directory~:"*some text"');
      reverseCheck('directory!~:"*some text"');
      reverseCheck('directory~:"*some\\* text"');
      reverseCheck('directory!~:"*some\\* text"');

    });

    it('And search', () => {
      reverseCheck('directory:(some text) and any-text:(some other)');
      reverseCheck('directory:(some text) and some and other');
    });

    it('Or search', () => {
      reverseCheck('directory:(some text) or any-text:(some other)');
      equalCheck('directory:(some text) or (some and other)', 'directory:(some text) or (any-text:some and any-text:other)');
      reverseCheck('directory:(some text) or (some and other)');
    });

    it('some of search', () => {
      reverseCheck('some-of:(a d v)');
      reverseCheck('2-of:(a d v)');
      reverseCheck('3-of:(a d v)');
    });

  });

  describe('should deserialize and serialize', () => {
    it('Text search', () => {
      check({type: SearchQueryTypes.any_text, value: 'test'} as TextSearch);
      check({type: SearchQueryTypes.person, value: 'person_test'} as TextSearch);
      check({type: SearchQueryTypes.directory, value: 'directory'} as TextSearch);
      check({type: SearchQueryTypes.directory, value: '2000.10.15 (Some event)'} as TextSearch);
      check({
        type: SearchQueryTypes.directory,
        value: '2000.10.15 (Some event)',
        matchType: TextSearchQueryMatchTypes.exact_match
      } as TextSearch);
      check({type: SearchQueryTypes.directory, value: '2000.10.15 (Some event) '} as TextSearch);
      check({type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch);
      check({type: SearchQueryTypes.caption, value: 'caption'} as TextSearch);
      check({type: SearchQueryTypes.title, value: 'image title'} as TextSearch);
      check({type: SearchQueryTypes.file_name, value: 'filename'} as TextSearch);
      check({type: SearchQueryTypes.position, value: 'New York'} as TextSearch);
      check({
        type: SearchQueryTypes.position,
        matchType: TextSearchQueryMatchTypes.exact_match,
        value: 'New York'
      } as TextSearch);
      check({
        type: SearchQueryTypes.position,
        matchType: TextSearchQueryMatchTypes.exact_match,
        negate: true,
        value: 'New York'
      } as TextSearch);

      check({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.globMatch,
        negate: true,
        value: 'a dir*'
      } as TextSearch);
      check({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.globMatch,
        value: '*a dir/test'
      } as TextSearch);

      check({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.globMatch,
        value: 'a?dir'
      } as TextSearch);

      check({
        type: SearchQueryTypes.directory,
        matchType: TextSearchQueryMatchTypes.globMatch,
        negate: true,
        value: 'test/a dir?'
      } as TextSearch);

      check({type: SearchQueryTypes.any_text, value: 'test', negate: true} as TextSearch);
    });

    it('Date search', () => {
      check({type: SearchQueryTypes.date, min: (Date.UTC(2020, 1, 10))} as DateSearch);
      check({type: SearchQueryTypes.date, min: (Date.UTC(2020, 1, 1))} as DateSearch);
      check({type: SearchQueryTypes.date, max: (Date.UTC(2020, 1, 20))} as DateSearch);
      check({type: SearchQueryTypes.date, max: (Date.UTC(2020, 1, 1))} as DateSearch);
      check({type: SearchQueryTypes.date, min: (Date.UTC(2020, 1, 1)), max: (Date.UTC(2020, 6, 9))} as DateSearch);
      check({type: SearchQueryTypes.date, min: (Date.UTC(2020, 1, 1)), max: (Date.UTC(2020, 6, 9)), negate: true} as DateSearch);
      check({type: SearchQueryTypes.date, min: (Date.UTC(2020, 1, 1)), negate: true} as DateSearch);
      check({type: SearchQueryTypes.date, max: (Date.UTC(2020, 1, 1)), negate: true} as DateSearch);

      const parser = new SearchQueryParser(defaultQueryKeywords);

      let query: RangeSearch = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 1, 4))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '>=' + '2020-02-04'))
        .to.deep.equals(query, parser.stringify(query));

      expect(parser.parse(defaultQueryKeywords.date + '>=' + '2020-2-4'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 1, 1))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '>=' + (new Date(query.min)).getFullYear() + '-' + '02'))
        .to.deep.equals(query, parser.stringify(query));

      // test if date gets simplified on 1st of Jan.
      query = {type: SearchQueryTypes.date, max: (Date.UTC(2020, 0, 1))} as DateSearch;
      expect(parser.parse(defaultQueryKeywords.date + '<=' + (new Date(query.max)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 0, 1))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '>=' + (new Date(query.min)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 0, 1)), max: (Date.UTC(2021, 0, 1))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + ':' + (new Date(query.min)).getFullYear() + '..' + (new Date(query.max)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 0, 1)), max: (Date.UTC(2021, 0, 1)), negate: true} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '!:' + (new Date(query.min)).getFullYear() + '..' + (new Date(query.max)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 0, 1))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '>=' + (new Date(query.min)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));


      query = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 0, 1)), max: (Date.UTC(2020, 0, 1))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '=' + (new Date(query.min)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 0, 1)), max: (Date.UTC(2020, 0, 1)), negate: true} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '!=' + (new Date(query.min)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.date, max: (Date.UTC(2020, 0, 1))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '<=' + (new Date(query.max)).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));


      query = ({type: SearchQueryTypes.date, max: (Date.UTC(2019, 11, 31))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '<' + (new Date(Date.UTC(2020, 0, 1))).getFullYear()))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.date, min: (Date.UTC(2020, 0, 1))} as DateSearch);
      expect(parser.parse(defaultQueryKeywords.date + '>' + '2019-12-31'))
        .to.deep.equals(query, parser.stringify(query));
    });
    it('Rating search', () => {
      const parser = new SearchQueryParser(defaultQueryKeywords);
      check({type: SearchQueryTypes.rating, min: 10} as RatingSearch);
      check({type: SearchQueryTypes.rating, max: 1} as RatingSearch);
      check({type: SearchQueryTypes.rating, min: 10, max: 144} as RatingSearch);
      check({type: SearchQueryTypes.rating, min: 10, negate: true} as RatingSearch);
      check({type: SearchQueryTypes.rating, max: 1, negate: true} as RatingSearch);


      let query: RangeSearch = ({type: SearchQueryTypes.rating, max: 1} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '<=1'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, min: 1} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '>=1'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, min: 1, negate: true} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '!>=1'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, min: 2} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '>1'))
        .to.deep.equals(query, parser.stringify(query));


      query = ({type: SearchQueryTypes.rating, min: 2, max: 5} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + ':2..5'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, min: 2, max: 2} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '=2'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, min: 2, max: 2} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + ':2'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, min: 2, max: 2, negate: true} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '!=2'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, max: 2} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '<3'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, max: 2, negate: true} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '!<3'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, min: 4, negate: true} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '!>3'))
        .to.deep.equals(query, parser.stringify(query));

      query = ({type: SearchQueryTypes.rating, min: 4, negate: true} as RatingSearch);
      expect(parser.parse(defaultQueryKeywords.rating + '!>3'))
        .to.deep.equals(query, parser.stringify(query));
    });
    it('Person count search', () => {
      check({type: SearchQueryTypes.person_count, min: 10} as PersonCountSearch);
      check({type: SearchQueryTypes.person_count, min: 3, max: 3} as PersonCountSearch);
      check({type: SearchQueryTypes.person_count, min: 3, max: 10} as PersonCountSearch);
      check({type: SearchQueryTypes.person_count, max: 1} as PersonCountSearch);
      check({type: SearchQueryTypes.person_count, min: 3, max: 3, negate: true} as PersonCountSearch);
      check({type: SearchQueryTypes.person_count, min: 3, max: 10, negate: true} as PersonCountSearch);
      check({type: SearchQueryTypes.person_count, min: 10, negate: true} as PersonCountSearch);
      check({type: SearchQueryTypes.person_count, max: 1, negate: true} as PersonCountSearch);
    });
    it('Resolution search', () => {
      check({type: SearchQueryTypes.resolution, min: 10} as ResolutionSearch);
      check({type: SearchQueryTypes.resolution, max: 5} as ResolutionSearch);
      check({type: SearchQueryTypes.resolution, min: 10, negate: true} as ResolutionSearch);
      check({type: SearchQueryTypes.resolution, max: 5, negate: true} as ResolutionSearch);
    });
    it('Distance search', () => {
      // Test location-based distance search
      check({type: SearchQueryTypes.distance, distance: 10, from: {value: 'New York'}} as DistanceSearch);
      check({type: SearchQueryTypes.distance, distance: 10, from: {value: 'New York'}, negate: true} as DistanceSearch);

      // Test coordinate-based distance search
      check({
        type: SearchQueryTypes.distance,
        distance: 5,
        from: {
          GPSData: {
            latitude: 40.712776,
            longitude: -74.005974
          }
        }
      } as DistanceSearch);

      // Test coordinate-based distance search with negation
      check({
        type: SearchQueryTypes.distance,
        distance: 5,
        from: {
          GPSData: {
            latitude: 40.712776,
            longitude: -74.005974
          }
        },
        negate: true
      } as DistanceSearch);

      // Test parsing specific coordinate formats
      const parser = new SearchQueryParser(defaultQueryKeywords);

      // Test basic coordinate format
      expect(parser.parse('5-km-from:(40.712776, -74.005974)')).to.deep.equals({
        type: SearchQueryTypes.distance,
        distance: 5,
        from: {
          GPSData: {
            latitude: 40.712776,
            longitude: -74.005974
          }
        }
      } as DistanceSearch);

      // Test coordinate format with extra spaces
      expect(parser.parse('5-km-from:(  40.712776  ,  -74.005974  )')).to.deep.equals({
        type: SearchQueryTypes.distance,
        distance: 5,
        from: {
          GPSData: {
            latitude: 40.712776,
            longitude: -74.005974
          }
        }
      } as DistanceSearch);

      // Test coordinates with different decimal places
      expect(parser.parse('5-km-from:(40.7, -74.1)')).to.deep.equals({
        type: SearchQueryTypes.distance,
        distance: 5,
        from: {
          GPSData: {
            latitude: 40.7,
            longitude: -74.1
          }
        }
      } as DistanceSearch);

      // Test negated coordinate search
      expect(parser.parse('5-km-from!:(40.712776, -74.005974)')).to.deep.equals({
        type: SearchQueryTypes.distance,
        distance: 5,
        from: {
          GPSData: {
            latitude: 40.712776,
            longitude: -74.005974
          }
        },
        negate: true
      } as DistanceSearch);

      // Test stringification of coordinates
      const query: DistanceSearch = {
        type: SearchQueryTypes.distance,
        distance: 5,
        from: {
          GPSData: {
            latitude: 40.712776,
            longitude: -74.005974
          }
        }
      };
      expect(parser.stringify(query)).to.equals('5-km-from:(40.712776, -74.005974)');

      // Test stringification of negated coordinates
      const negatedQuery: DistanceSearch = {
        ...query,
        negate: true
      };
      expect(parser.stringify(negatedQuery)).to.equals('5-km-from!:(40.712776, -74.005974)');
    });
    it('OrientationSearch search', () => {
      check({type: SearchQueryTypes.orientation, landscape: true} as OrientationSearch);
      check({type: SearchQueryTypes.orientation, landscape: false} as OrientationSearch);
    });
    it('Date patter search', () => {
      for (let i = 0; i <= 10; ++i) {
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.every_week
        } as DatePatternSearch);
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.every_month
        } as DatePatternSearch);
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.every_year
        } as DatePatternSearch);
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.days_ago,
          agoNumber: 0
        } as DatePatternSearch);
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.days_ago,
          agoNumber: 1
        } as DatePatternSearch);
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.weeks_ago,
          agoNumber: 1
        } as DatePatternSearch);
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.months_ago,
          agoNumber: 1
        } as DatePatternSearch);
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.years_ago,
          agoNumber: 1
        } as DatePatternSearch);
        check({
          type: SearchQueryTypes.date_pattern, daysLength: i,
          frequency: DatePatternFrequency.years_ago,
          agoNumber: 1,
          negate: true
        } as DatePatternSearch);
      }
    });
    it('Default logical operator should be AND', () => {

      const parser = new SearchQueryParser(defaultQueryKeywords);
      expect(parser.parse('a b')).to.deep.equals({
        type: SearchQueryTypes.AND,
        list: [
          {type: SearchQueryTypes.any_text, value: 'a'} as TextSearch,
          {type: SearchQueryTypes.any_text, value: 'b'} as TextSearch
        ]
      } as ANDSearchQuery);
    });
    it('And search', () => {
      check({
        type: SearchQueryTypes.AND,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {type: SearchQueryTypes.position, value: 'New York'} as TextSearch
        ]
      } as ANDSearchQuery);

      check({
        type: SearchQueryTypes.AND,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {
            type: SearchQueryTypes.position,
            matchType: TextSearchQueryMatchTypes.exact_match,
            value: 'New York'
          } as TextSearch
        ]
      } as ANDSearchQuery);
      check({
        type: SearchQueryTypes.AND,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {type: SearchQueryTypes.caption, value: 'caption'} as TextSearch,
          {type: SearchQueryTypes.position, value: 'New York'} as TextSearch
        ]
      } as ANDSearchQuery);
      check({
        type: SearchQueryTypes.AND,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {type: SearchQueryTypes.caption, value: 'caption'} as TextSearch,
          {
            type: SearchQueryTypes.OR,
            list: [
              {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
              {type: SearchQueryTypes.position, value: 'New York'} as TextSearch,
              {
                type: SearchQueryTypes.AND,
                list: [
                  {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
                  {type: SearchQueryTypes.caption, value: 'caption'} as TextSearch,
                  {type: SearchQueryTypes.position, value: 'New York'} as TextSearch
                ]
              } as ANDSearchQuery
            ]
          } as ORSearchQuery
        ]
      } as ANDSearchQuery);
      check({
        type: SearchQueryTypes.AND,
        list: [
          {
            type: SearchQueryTypes.SOME_OF,
            min: 2,
            list: [
              {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
              {type: SearchQueryTypes.position, value: 'New York'} as TextSearch,
              {type: SearchQueryTypes.caption, value: 'caption test'} as TextSearch
            ]
          } as SomeOfSearchQuery,
          {type: SearchQueryTypes.position, value: 'New York'} as TextSearch
        ]
      } as ANDSearchQuery);
    });
    it('Or search', () => {
      check({
        type: SearchQueryTypes.OR,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {type: SearchQueryTypes.position, value: 'New York'} as TextSearch
        ]
      } as ORSearchQuery);
      check({
        type: SearchQueryTypes.OR,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {type: SearchQueryTypes.person, value: 'person_test'} as TextSearch,
          {type: SearchQueryTypes.position, value: 'New York'} as TextSearch
        ]
      } as ORSearchQuery);
    });
    it('Some of search', () => {
      check({
        type: SearchQueryTypes.SOME_OF,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {type: SearchQueryTypes.position, value: 'New York'} as TextSearch
        ]
      } as SomeOfSearchQuery);
      check({
        type: SearchQueryTypes.SOME_OF,
        list: [
          {
            type: SearchQueryTypes.keyword,
            matchType: TextSearchQueryMatchTypes.exact_match,
            value: 'big boom'
          } as TextSearch,
          {
            type: SearchQueryTypes.position,
            matchType: TextSearchQueryMatchTypes.exact_match,
            value: 'New York'
          } as TextSearch,
        ]
      } as SomeOfSearchQuery);
      check({
        type: SearchQueryTypes.SOME_OF,
        min: 2,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {type: SearchQueryTypes.position, value: 'New York'} as TextSearch,
          {type: SearchQueryTypes.caption, value: 'caption test'} as TextSearch
        ]
      } as SomeOfSearchQuery);
      check({
        type: SearchQueryTypes.SOME_OF,
        min: 2,
        list: [
          {type: SearchQueryTypes.keyword, value: 'big boom'} as TextSearch,
          {type: SearchQueryTypes.person, value: 'person_test'} as TextSearch,
          {
            type: SearchQueryTypes.AND,
            list: [
              {type: SearchQueryTypes.caption, value: 'caption'} as TextSearch,
              {type: SearchQueryTypes.position, value: 'New York'} as TextSearch
            ]
          } as ANDSearchQuery
        ]
      } as SomeOfSearchQuery);
    });
  });


});
