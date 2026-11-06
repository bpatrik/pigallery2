import {ErrorDTO} from './Error';

export class Message<T> {
  public error: ErrorDTO | null = null;
  public result: T | null = null;

  constructor(error: ErrorDTO | null, result: T | null) {
    this.error = error;
    this.result = result;
  }
}
