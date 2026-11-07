import {Utils} from '../../../common/Utils';

export interface TaskQueEntry<I, O> {
  data: I;
  promise: {
    obj: Promise<O>;
    resolve: (ret: O) => void;
    reject: (err: any) => void;
  };
}

export class TaskQue<I, O> {
  private tasks: TaskQueEntry<I, O>[] = [];
  private processing: TaskQueEntry<I, O>[] = [];

  public isEmpty(): boolean {
    return this.tasks.length === 0;
  }

  public add(input: I): TaskQueEntry<I, O> {
    return this.getSameTask(input) || this.putNewTask(input);
  }

  public get(): TaskQueEntry<I, O> | undefined {
    const task = this.tasks.shift();
    if (task) {
      this.processing.push(task);
    }
    return task;
  }

  public ready(task: TaskQueEntry<I, O>): void {
    const index = this.processing.indexOf(task);
    if (index === -1) {
      throw new Error('Task does not exist');
    }
    this.processing.splice(index, 1);
  }

  private getSameTask(input: I): TaskQueEntry<I, O> | undefined {
    return this.tasks.find((t) => Utils.equalsFilter(t.data, input)) ||
        this.processing.find((t) =>
            Utils.equalsFilter(t.data, input)
        );
  }

  private putNewTask(input: I): TaskQueEntry<I, O> {
    // assigned synchronously by the Promise executor
    let resolve!: (ret: O) => void;
    let reject!: (err: any) => void;
    const obj = new Promise<O>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const taskEntry: TaskQueEntry<I, O> = {
      data: input,
      promise: {obj, resolve, reject},
    };
    this.tasks.push(taskEntry);
    return taskEntry;
  }
}
