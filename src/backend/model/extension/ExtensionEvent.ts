import {IExtensionAfterEventHandler, IExtensionBeforeEventHandler, IExtensionEvent} from './IExtension';

export class ExtensionEvent<I extends unknown[], O> implements IExtensionEvent<I, O> {
  protected beforeHandlers: IExtensionBeforeEventHandler<I, O>[] = [];
  protected afterHandlers: IExtensionAfterEventHandler<I, O>[] = [];

  public before(handler: IExtensionBeforeEventHandler<I, O>): void {
    if (typeof handler !== 'function') {
      throw new Error('ExtensionEvent::before: Handler is not a function');
    }
    this.beforeHandlers.push(handler);
  }

  public after(handler: IExtensionAfterEventHandler<I, O>): void {
    if (typeof handler !== 'function') {
      throw new Error('ExtensionEvent::after: Handler is not a function');
    }
    this.afterHandlers.push(handler);
  }

  public offAfter(handler: IExtensionAfterEventHandler<I, O>): void {
    this.afterHandlers = this.afterHandlers.filter((h) => h !== handler);
  }

  public offBefore(handler: IExtensionBeforeEventHandler<I, O>): void {
    this.beforeHandlers = this.beforeHandlers.filter((h) => h !== handler);
  }


  public async triggerBefore(input: I, event: { stopPropagation: boolean }): Promise<I | O> {
    let pipe: I | O = input;
    if (this.beforeHandlers && this.beforeHandlers.length > 0) {
      const s = this.beforeHandlers.slice(0);
      for (let i = 0; i < s.length; ++i) {
        if (event.stopPropagation) {
          break;
        }
        pipe = await s[i](pipe as I, event);
      }
    }
    return pipe;
  }

  public async triggerAfter(input: I, output: O): Promise<O> {
    if (this.afterHandlers && this.afterHandlers.length > 0) {
      const s = this.afterHandlers.slice(0);
      for (let i = 0; i < s.length; ++i) {
        output = await s[i]({input, output});
      }
    }
    return output;
  }

}



