import {expect} from 'chai';
import {TaskQue} from '../../../../../src/backend/model/fileaccess/TaskQue';

describe('TaskQue', () => {

  it('should be empty', () => {
    const tq = new TaskQue<number, number>();
    expect(tq.isEmpty()).to.be.equal(true);
    tq.add(2);
    expect(tq.isEmpty()).to.be.equal(false);
    tq.ready(tq.get());
    expect(tq.isEmpty()).to.be.equal(true);
  });

  it('should get', () => {
    const tq = new TaskQue<number, number>();
    tq.add(2);
    expect(tq.get().data).to.be.equal(2);
    expect(tq.get).to.throw();
  });
  it('should set ready', () => {
    const tq = new TaskQue<number, number>();
    tq.add(2);
    const task = tq.get();
    tq.ready(task);
    expect(tq.isEmpty()).to.be.equal(true);
    expect(tq.ready.bind(tq, task)).to.be.throw('Task does not exist');
  });
});
