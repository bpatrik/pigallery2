import {SearchQueryTypes} from '../../../../../common/entities/SearchQueryDTO';
import {foldChar} from '../../../../../common/TextFold';

export class AutoCompleteRenderItem {
  public preText = '';
  public highLightText = '';
  public postText = '';
  public type: SearchQueryTypes | null | undefined;
  public queryHint: string;
  public notSearchable: boolean;

  constructor(
      public text: string,
      searchText: string,
      type: SearchQueryTypes | null | undefined,
      queryHint: string,
      notSearchable = false
  ) {
    const match = AutoCompleteRenderItem.find(text, searchText);
    if (match) {
      this.preText = text.substring(0, match.start);
      this.highLightText = text.substring(match.start, match.end);
      this.postText = text.substring(match.end);
    } else {
      this.postText = text;
    }
    this.type = type;
    this.queryHint = queryHint;
    this.notSearchable = notSearchable;
  }

  /**
   * Where the typed text is in the text, ignoring the accents and the case, as the server suggests "Utazás" for "utaza" (#1309).
   * Folds letter by letter, so each folded letter can be traced back to its place in the text.
   */
  private static find(text: string, searchText: string): { start: number, end: number } | null {
    let folded = '';
    const starts: number[] = [];
    const ends: number[] = [];
    let i = 0;
    for (const char of text) { // by code point, so an emoji is not split
      const f = foldChar(char);
      // a letter can fold to more or fewer UTF-16 units than it has
      starts.push(...new Array<number>(f.length).fill(i));
      ends.push(...new Array<number>(f.length).fill(i + char.length));
      folded += f;
      i += char.length;
    }
    const typed = Array.from(searchText, foldChar).join('');
    const index = typed ? folded.indexOf(typed) : -1;
    if (index < 0) {
      return null;
    }
    return {start: starts[index], end: ends[index + typed.length - 1]};
  }
}
