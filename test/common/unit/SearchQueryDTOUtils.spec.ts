import {expect} from 'chai';
import {
  ANDSearchQuery,
  DatePatternFrequency,
  DatePatternSearch,
  ORSearchQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
} from '../../../src/common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../src/common/SearchQueryUtils';

const eq = (a: SearchQueryDTO, b: SearchQueryDTO) => {
  const sa = SearchQueryUtils.stringifyForComparison(a);
  const sb = SearchQueryUtils.stringifyForComparison(b);
  expect(sa).to.equal(sb, 'should be equal');
};

describe('SearchQueryDTOUtils.sortQuery', () => {
  describe('AND and OR ordering', () => {
    it('should treat (A AND B) equal to (B AND A)', () => {
      const A: TextSearch = {type: SearchQueryTypes.keyword, value: 'alpha'};
      const B: TextSearch = {type: SearchQueryTypes.person, value: 'bob'};
      const q1: ANDSearchQuery = {type: SearchQueryTypes.AND, list: [A, B]};
      const q2: ANDSearchQuery = {type: SearchQueryTypes.AND, list: [B, A]};

      eq(q1, q2);

      const s = SearchQueryUtils.sortQuery(q2) as ANDSearchQuery;
      expect((s.list[0] as TextSearch).value).to.equal('alpha');
      expect((s.list[1] as TextSearch).value).to.equal('bob');
    });

    it('should treat (A OR B) equal to (B OR A)', () => {
      const A: TextSearch = {type: SearchQueryTypes.caption, value: 'summer'};
      const B: TextSearch = {type: SearchQueryTypes.directory, value: 'holidays'};
      const q1: ORSearchQuery = {type: SearchQueryTypes.OR, list: [A, B]};
      const q2: ORSearchQuery = {type: SearchQueryTypes.OR, list: [B, A]};

      eq(q1, q2);

      const s = SearchQueryUtils.sortQuery(q1) as ORSearchQuery;
      expect(s.list.map((c) => (c as TextSearch).value)).to.deep.equal(['summer', 'holidays']);
    });
  });

  describe('SOME_OF ordering and min preservation', () => {
    it('should keep min and ignore list order; also preserve negate flags', () => {
      const x1: TextSearch = {type: SearchQueryTypes.keyword, value: 'x'};
      const x2: TextSearch = {type: SearchQueryTypes.person, value: 'y', negate: true};
      const x3: TextSearch = {type: SearchQueryTypes.directory, value: 'z'};

      const q1: SomeOfSearchQuery = {
        type: SearchQueryTypes.SOME_OF,
        min: 2,
        list: [x2, x3, x1],
      };
      const q2: SomeOfSearchQuery = {
        type: SearchQueryTypes.SOME_OF,
        min: 2,
        list: [x1, x2, x3],
      };

      eq(q1, q2);

      const s = SearchQueryUtils.sortQuery(q1) as SomeOfSearchQuery;
      expect(s.min).to.equal(2);
      expect(s.list).to.have.length(3);
      // Ensure all children are present with the same negate flags
      const serializedChildren = s.list.map((c) => SearchQueryUtils.stringifyForComparison(c));
      const expected = [x1, x2, x3].map((c) => SearchQueryUtils.stringifyForComparison(c));
      expect(serializedChildren.sort()).to.deep.equal(expected.sort());

      // Negate flag stayed on the same semantic child (person:y)
      const hasNegPersonY = s.list.some((c) => (c as TextSearch).type === SearchQueryTypes.person && (c as TextSearch).value === 'y' && !!(c as TextSearch).negate);
      expect(hasNegPersonY).to.equal(true);
    });
  });

  describe('Property order canonicalization', () => {
    it('should treat leaf objects with different key orders as equal (TextSearch)', () => {
      // Note: object literal property order differs
      const a1: TextSearch = {type: SearchQueryTypes.directory, value: 'a', matchType: TextSearchQueryMatchTypes.exact_match};
      const a2: any = {value: 'a', matchType: TextSearchQueryMatchTypes.exact_match, type: SearchQueryTypes.directory};

      eq(a1, a2);
    });

    it('should canonicalize nested object keys (DistanceSearch.from and GPSData)', () => {
      const q1: SearchQueryDTO = {
        type: SearchQueryTypes.distance,
        distance: 5,
        from: {
          GPSData: {longitude: 10.123456, latitude: 20.654321},
          value: 'loc',
        },
      } as any;
      const q2: SearchQueryDTO = {
        type: SearchQueryTypes.distance,
        from: {
          value: 'loc',
          GPSData: {latitude: 20.654321, longitude: 10.123456},
        },
        distance: 5,
      } as any;

      eq(q1, q2);

      // Ensure values are preserved after sort
      const s = SearchQueryUtils.sortQuery(q1) as any;
      expect(s.distance).to.equal(5);
      expect(s.from.GPSData.latitude).to.equal(20.654321);
      expect(s.from.GPSData.longitude).to.equal(10.123456);
    });

    it('should ignore undefined vs missing optional properties', () => {
      const a1: TextSearch = {type: SearchQueryTypes.file_name, value: 'IMG_1234', matchType: undefined as any};
      const a2: TextSearch = {type: SearchQueryTypes.file_name, value: 'IMG_1234'};
      eq(a1, a2);
    });
  });

  describe('Nested combinations', () => {
    it('should canonicalize nested AND/OR combinations consistently', () => {
      const A: TextSearch = {type: SearchQueryTypes.keyword, value: 'a'};
      const B: TextSearch = {type: SearchQueryTypes.caption, value: 'b'};

      const q1: ANDSearchQuery = {
        type: SearchQueryTypes.AND,
        list: [
          {type: SearchQueryTypes.OR, list: [A, B]} as ORSearchQuery,
          A,
        ],
      };
      const q2: ANDSearchQuery = {
        type: SearchQueryTypes.AND,
        list: [
          A,
          {type: SearchQueryTypes.OR, list: [B, A]} as ORSearchQuery,
        ],
      };

      eq(q1, q2);
    });
  });
});


// Added tests to cover validateSearchQuery behavior with negate:false
// The validation should not fail merely because a negate:false property exists, even deeply nested.

describe('SearchQueryDTOUtils.validateSearchQuery', () => {
  const assertValid = (q: SearchQueryDTO) => {
    expect(() => SearchQueryUtils.validateSearchQuery(q, 'SearchQuery')).to.not.throw();
  };

  it('should validate a top-level leaf with mathtype exact_match', () => {
    const q: TextSearch = {type: SearchQueryTypes.person, value: 'alice', matchType: TextSearchQueryMatchTypes.exact_match};
    assertValid(q);
  });

  it('should validate a top-level leaf with mathtype like', () => {
    const q: TextSearch = {type: SearchQueryTypes.person, value: 'alice', matchType: TextSearchQueryMatchTypes.like};
    assertValid(q);
  });

  it('should validate a top-level leaf with mathtype like and spaces', () => {
    const q: TextSearch = {type: SearchQueryTypes.person, value: 'alice doe', matchType: TextSearchQueryMatchTypes.like};
    assertValid(q);
  });

  it('should validate a top-level leaf with negate:false', () => {
    const q: TextSearch = {type: SearchQueryTypes.person, value: 'alice', negate: false};
    assertValid(q);
  });

  it('should validate an AND with a child having negate:false', () => {
    const q: ANDSearchQuery = {
      type: SearchQueryTypes.AND,
      list: [
        {type: SearchQueryTypes.person, value: 'bob', negate: false} as TextSearch,
        {type: SearchQueryTypes.keyword, value: 'k'} as TextSearch,
      ],
    };
    assertValid(q);
  });

  it('should validate nested OR inside AND where a grandchild has negate:false', () => {
    const q: ANDSearchQuery = {
      type: SearchQueryTypes.AND,
      list: [
        {
          type: SearchQueryTypes.OR,
          list: [
            {type: SearchQueryTypes.directory, value: '/a', negate: false} as TextSearch,
            {type: SearchQueryTypes.caption, value: 'c'} as TextSearch,
          ],
        } as ORSearchQuery,
        {type: SearchQueryTypes.file_name, value: 'IMG'} as TextSearch,
      ],
    };
    assertValid(q);
  });

  it('should validate SOME_OF with negate:false child and min set', () => {
    const q: SomeOfSearchQuery = {
      type: SearchQueryTypes.SOME_OF,
      min: 1,
      list: [
        {type: SearchQueryTypes.keyword, value: 'x', negate: false} as TextSearch,
        {type: SearchQueryTypes.person, value: 'y'} as TextSearch,
      ],
    };
    assertValid(q);
  });
});


describe('SearchQueryDTOUtils.urlify', () => {
  const assertValid = (q: SearchQueryDTO) => {
    expect(SearchQueryUtils.urlify(q).length).to.be.lessThan(JSON.stringify(SearchQueryUtils.stripDefault(q)).length);
    expect(SearchQueryUtils.parseURLifiedQuery(SearchQueryUtils.urlify(q))).to.deep.equal(SearchQueryUtils.stripDefault(q));
  };

  it('should validate a top-level leaf with negate:false', () => {
    const q: TextSearch = {type: SearchQueryTypes.person, value: 'alice', negate: false};
    assertValid(q);
    expect(SearchQueryUtils.urlify(q)).to.equal('{"t":105,"v":"alice"}');
  });

  it('should validate an AND with a child having negate:false', () => {
    const q: ANDSearchQuery = {
      type: SearchQueryTypes.AND,
      list: [
        {type: SearchQueryTypes.person, value: 'bob', negate: false} as TextSearch,
        {type: SearchQueryTypes.keyword, value: 'k'} as TextSearch,
      ],
    };
    assertValid(q);
    expect(SearchQueryUtils.urlify(q)).to.equal('{"t":1,"l":[{"t":105,"v":"bob"},{"t":104,"v":"k"}]}');
  });

  it('should use shortened JSON for complex/ambiguous queries if necessary', () => {
    // A query that might be hard for the parser to perfectly round-trip if it has weird text
    const q: TextSearch = {type: SearchQueryTypes.any_text, value: 'after:2020', negate: false};
    // The parser might see "after:2020" and think it's a FromDateSearch if not careful.
    // Actually our parser handles quotes/brackets.
    assertValid(q);
  });

  it('should shorten keys in JSON', () => {
    const q: SearchQueryDTO = {
      type: SearchQueryTypes.distance,
      distance: 10,
      from: {
        value: 'Budapest',
        GPSData: {
          latitude: 47,
          longitude: 19
        }
      }
    } as any;
    // distance is handled by parser: "10-km-from:Budapest" or similar
    // If it used JSON, it should be shorter.
    assertValid(q);
  });

  it('should handle relative time query', () => {
    const q: DatePatternSearch = {
      type: SearchQueryTypes.date_pattern,
      daysLength: 3,
      negate: true,
      frequency: DatePatternFrequency.every_year
    };
    assertValid(q);
  });

  it('should handle complex queries', () => {
    const q: ANDSearchQuery = {
      type: SearchQueryTypes.AND,
      list: [
        {
          type: SearchQueryTypes.any_text,
          value: '0.1-km-from:(8004 Dienerstrasse 7)'
        } as TextSearch,
        {
          type: SearchQueryTypes.person,
          value: 'Szendrei Alma',
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch
      ]
    };
    assertValid(q);
  });
});
