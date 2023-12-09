export class EventLimit<T> {
  private lastTriggerValue: T = null;

  private handlers: Array<EventLimitHandler<T>> = [];

  public on(limit: T, handler: (data?: T) => void): void {
    this.handlers.push(new EventLimitHandler(limit, handler));
    if (this.lastTriggerValue != null) {
      this.trigger(this.lastTriggerValue);
    }
  }

  public onSingle(limit: T, handler: (data?: T) => void): void {
    this.handlers.push(new SingleFireEventLimitHandler(limit, handler));
    if (this.lastTriggerValue != null) {
      this.trigger(this.lastTriggerValue);
    }
  }

  public off(limit: T, handler: (data?: T) => void): void {
    this.handlers = this.handlers.filter(
        (h) => h.handler !== handler && h.limit !== limit
    );
  }

  public allOff(): void {
    this.handlers = [];
  }

  public trigger = (data?: T) => {
    if (this.handlers) {
      this.handlers.slice(0).forEach((h) => {
        if (
            h.limit <= data &&
            (h.lastTriggerValue < h.limit || h.lastTriggerValue == null)
        ) {
          h.fire(data);
        }
        h.lastTriggerValue = data;
      });
      this.handlers = this.handlers.filter((h) => h.isValid());
    }
    this.lastTriggerValue = data;
  };
}

class EventLimitHandler<T> {
  public lastTriggerValue: T = null;

  constructor(public limit: T, public handler: (data?: T) => void) {
  }

  public fire(data?: T): void {
    this.handler(data);
  }

  public isValid(): boolean {
    return true;
  }
}

class SingleFireEventLimitHandler<T> extends EventLimitHandler<T> {
  public fired = false;

  constructor(public limit: T, public handler: (data?: T) => void) {
    super(limit, handler);
  }

  public fire(data?: T): void {
    if (this.fired === false) {
      this.handler(data);
    }
    this.fired = true;
  }

  public isValid(): boolean {
    return this.fired === false;
  }
}
