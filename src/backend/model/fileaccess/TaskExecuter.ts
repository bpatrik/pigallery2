import {TaskQue} from './TaskQue';
import {EventLoopHandler} from '../EventLoopHandler';

export interface ITaskExecuter<I, O> {
  execute(input: I): Promise<O>;
}

export class TaskExecuter<I, O> implements ITaskExecuter<I, O> {
  private taskQue = new TaskQue<I, O>();
  private taskInProgress = 0;
  private readonly el = new EventLoopHandler();
  private run = async () => {
    if (this.taskQue.isEmpty() || this.taskInProgress >= this.size) {
      return;
    }
    this.taskInProgress++;
    const task = this.taskQue.get();
    try {
      task.promise.resolve(await this.worker(task.data));
    } catch (err) {
      task.promise.reject(err);
    }
    this.taskQue.ready(task);
    this.taskInProgress--;
    this.el.step(this.run);
  };

  constructor(private size: number, private worker: (input: I) => Promise<O>) {
  }

  execute(input: I): Promise<O> {
    const promise = this.taskQue.add(input).promise.obj;
    this.run().catch(console.error);
    return promise;
  }
}
