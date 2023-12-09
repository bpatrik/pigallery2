import {Utils} from '../../../common/Utils';

export interface TaskQueEntry<I, O> {
  data: I;
  promise: {
    obj: Promise<O> | null;
    resolve: ((ret: O) => void) | null;
    reject: ((err: any) => void) | null;
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

  public get(): TaskQueEntry<I, O> {
    const task = this.tasks.shift() as TaskQueEntry<I, O>;
    this.processing.push(task);
    return task;
  }

  public ready(task: TaskQueEntry<I, O>): void {
    const index = this.processing.indexOf(task);
    if (index === -1) {
      throw new Error('Task does not exist');
    }
    this.processing.splice(index, 1);
  }

  private getSameTask(input: I): TaskQueEntry<I, O> {
    return (this.tasks.find((t) => Utils.equalsFilter(t.data, input)) ||
        this.processing.find((t) =>
            Utils.equalsFilter(t.data, input)
        )) as TaskQueEntry<I, O>;
  }

  private putNewTask(input: I): TaskQueEntry<I, O> {
    const taskEntry: TaskQueEntry<I, O> = {
      data: input,
      promise: {
        obj: null,
        resolve: null,
        reject: null,
      },
    };
    this.tasks.push(taskEntry);
    taskEntry.promise.obj = new Promise<O>(
        (resolve: (ret: O) => void, reject: (err: any) => void) => {
          taskEntry.promise.reject = reject;
          taskEntry.promise.resolve = resolve;
        }
    );
    return taskEntry;
  }
}
