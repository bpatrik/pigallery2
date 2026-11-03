import {MatchingTypeDescriptionPipe} from './MatchingTypeDescriptionPipe';
import {TextSearchMatchingTypes} from '../ui/gallery/search/query-enrty/TextSearchMatchingTypes';

describe('MatchingTypeDescriptionPipe', () => {
  const pipe = new MatchingTypeDescriptionPipe();

  it('should describe every matching type', () => {
    for (const type of TextSearchMatchingTypes.values) {
      expect(pipe.transform(type, true)).toBe(TextSearchMatchingTypes.getDescription(type, true));
    }
  });

  it('should describe "=" differently for text and other queries', () => {
    expect(pipe.transform('=', true)).toContain('bb');
    expect(pipe.transform('=', false)).toBe('Exact match');
  });
});
