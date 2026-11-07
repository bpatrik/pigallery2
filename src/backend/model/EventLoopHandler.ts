export class EventLoopHandler {

  private eventCounter = 0;

  constructor(private readonly MAX_LOOP = 10) {
  }

  /*
  * setImmediate is slow, but does the right thing
  * next tick is super fast, but does not help much with the event loop as it does not allow a full event loop cycle
  * https://medium.com/dkatalis/eventloop-in-nodejs-settimeout-setimmediate-vs-process-nexttick-37c852c67acb
  * */
  step(fn: () => void) {

    this.eventCounter = this.eventCounter % 10;
    if (this.eventCounter++ === 1) {
      setImmediate(fn);
    } else {
      process.nextTick(fn);
    }
  }
}
