import {expect} from 'chai';
import {TaskExecuter} from '../../../../../src/backend/model/fileaccess/TaskExecuter';

describe('TaskExecuter', () => {

  it('should execute', async () => {
    const taskWorker = (input: number) => {
      return new Promise<number>((resolve, reject) => {
        setTimeout(() => {
          resolve(input * 2);
        }, 1);
      });
    };

    const tq = new TaskExecuter<number, number>(10, taskWorker);

    expect(await tq.execute(1)).to.be.equal(2);
    expect(await tq.execute(10)).to.be.equal(20);
    expect(await tq.execute(1)).to.be.equal(2);
    expect(await tq.execute(111)).to.be.equal(222);
  });

  it('should fail', async () => {
    const taskWorker = (input: number) => {
      return new Promise<number>((resolve, reject) => {
        setTimeout(() => {
          reject((input * 2).toString());
        }, 1);
      });
    };

    const tq = new TaskExecuter<number, number>(10, taskWorker);

    try {
      await tq.execute(1);
      expect(false).to.be.equal(true); // should not reach
    } catch (e) {
      expect(e).to.be.equal('2');
    }
  });

  it('should handle race condition', async () => {
    let counter = 0;
    const taskWorker = (input: number) => {
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          counter++;
          resolve();
        }, 1);
      });
    };

    const tq = new TaskExecuter<number, void>(10, taskWorker);

    const prs = [];
    prs.push(tq.execute(1));
    prs.push(tq.execute(1));
    prs.push(tq.execute(1));
    prs.push(tq.execute(2));
    prs.push(tq.execute(2));
    await Promise.all(prs);
    expect(counter).to.be.equal(2);

  });

});
