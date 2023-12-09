import {SearchQueryTypes} from '../../../../../common/entities/SearchQueryDTO';

export class AutoCompleteRenderItem {
  public preText = '';
  public highLightText = '';
  public postText = '';
  public type: SearchQueryTypes;
  public queryHint: string;
  public notSearchable: boolean;

  constructor(
      public text: string,
      searchText: string,
      type: SearchQueryTypes,
      queryHint: string,
      notSearchable = false
  ) {
    const preIndex = text.toLowerCase().indexOf(searchText.toLowerCase());
    if (preIndex > -1) {
      this.preText = text.substring(0, preIndex);
      this.highLightText = text.substring(
          preIndex,
          preIndex + searchText.length
      );
      this.postText = text.substring(preIndex + searchText.length);
    } else {
      this.postText = text;
    }
    this.type = type;
    this.queryHint = queryHint;
    this.notSearchable = notSearchable;
  }
}
