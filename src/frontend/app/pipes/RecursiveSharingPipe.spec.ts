import {RecursiveSharingPipe} from './RecursiveSharingPipe';
import {ResponseSharingDTO} from '../../../common/entities/SharingDTO';
import {SearchQueryTypes, TextSearchQueryMatchTypes} from '../../../common/entities/SearchQueryDTO';

describe('RecursiveSharingPipe', () => {
  const pipe = new RecursiveSharingPipe();
  const sharing = (matchType: TextSearchQueryMatchTypes, value: string): ResponseSharingDTO =>
    ({directoryQuery: {type: SearchQueryTypes.directory, matchType, value}} as ResponseSharingDTO);

  it('should be true for a directory glob ending with *', () => {
    expect(pipe.transform(sharing(TextSearchQueryMatchTypes.globMatch, './Nyaralás/Őszi kirándulás/*'))).toBe(true);
  });

  it('should be false for an exact directory or a search sharing', () => {
    expect(pipe.transform(sharing(TextSearchQueryMatchTypes.exact_match, './Nyaralás/Őszi kirándulás'))).toBe(false);
    expect(pipe.transform(sharing(TextSearchQueryMatchTypes.globMatch, './Nyaralás/*.jpg'))).toBe(false);
    expect(pipe.transform({searchQuery: {type: SearchQueryTypes.any_text}} as ResponseSharingDTO)).toBeFalsy();
  });
});
