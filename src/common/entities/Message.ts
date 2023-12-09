import {ErrorDTO} from './Error';

export class Message<T> {
  public error: ErrorDTO = null;
  public result: T = null;

  constructor(error: ErrorDTO, result: T) {
    this.error = error;
    this.result = result;
  }
}
