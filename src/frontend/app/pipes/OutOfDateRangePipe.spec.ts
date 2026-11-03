import {OutOfDateRangePipe} from './OutOfDateRangePipe';

describe('OutOfDateRangePipe', () => {
  const pipe = new OutOfDateRangePipe();
  const period = {date: new Date(2020, 0, 1), endDate: new Date(2020, 1, 1)};

  it('should be false if the period overlaps the range', () => {
    expect(pipe.transform(period, Number.MIN_VALUE, Number.MAX_VALUE)).toBe(false);
    expect(pipe.transform(period, new Date(2020, 0, 15).getTime(), new Date(2021, 0, 1).getTime())).toBe(false);
    expect(pipe.transform(period, period.endDate.getTime(), period.date.getTime())).toBe(false);
  });

  it('should be true if the period ends before or starts after the range', () => {
    expect(pipe.transform(period, period.endDate.getTime() + 1, Number.MAX_VALUE)).toBe(true);
    expect(pipe.transform(period, Number.MIN_VALUE, period.date.getTime() - 1)).toBe(true);
  });
});
