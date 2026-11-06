import {SearchQueryTypes} from './SearchQueryDTO';

export interface IAutoCompleteItem {
  value: string;
  type?: SearchQueryTypes | null;
}

export class AutoCompleteItem implements IAutoCompleteItem {
  constructor(public value: string, public type: SearchQueryTypes | null = null) {
  }

  equals(other: AutoCompleteItem): boolean {
    return this.value === other.value && this.type === other.type;
  }
}

