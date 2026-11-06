import {expect} from 'chai';
import {JobScheduleDTOUtils, JobTriggerType} from '../../../src/common/entities/job/JobScheduleDTO';

describe('JobScheduleDTO', () => {

  it('should get date from schedule', async () => {

    const refDate = new Date(Date.UTC(2019, 7, 18, 5, 10, 10, 0)); // its a sunday


    expect(JobScheduleDTOUtils.getNextRunningDate(refDate, {
      trigger: {
        type: JobTriggerType.scheduled,
        time: (new Date(2019, 7, 18, 5, 10)).getTime()
      }
    } as any)).to.be.deep.equal((new Date(2019, 7, 18, 5, 10, 0)));


    for (let dayOfWeek = 0; dayOfWeek < 7; ++dayOfWeek) {
      let nextDay = dayOfWeek < 6 ? (18 + dayOfWeek + 1) : 18;

      let h = 10;
      let m = 5;
      expect(JobScheduleDTOUtils.getNextRunningDate(refDate, {
        trigger: {
          type: JobTriggerType.periodic,
          atTime: (h * 60 + m),
          periodicity: dayOfWeek
        }
      } as any)).to.be.deep.equal((new Date(Date.UTC(2019, 7, nextDay, h, m, 0))), 'for day: ' + dayOfWeek);

      h = 2;
      m = 5;
      nextDay = 18 + dayOfWeek + 1;
      expect(JobScheduleDTOUtils.getNextRunningDate(refDate, {
        trigger: {
          type: JobTriggerType.periodic,
          atTime: (h * 60 + m),
          periodicity: dayOfWeek
        }
      } as any)).to.be.deep.equal((new Date(Date.UTC(2019, 7, nextDay, h, m, 0))), 'for day: ' + dayOfWeek);

      h = 5;
      m = 10;
      nextDay = 18 + dayOfWeek + 1;
      expect(JobScheduleDTOUtils.getNextRunningDate(refDate, {
        trigger: {
          type: JobTriggerType.periodic,
          atTime: (h * 60 + m),
          periodicity: dayOfWeek
        }
      } as any)).to.be.deep.equal((new Date(Date.UTC(2019, 7, nextDay, h, m, 0))), 'for day: ' + dayOfWeek);
    }

    {
      const h = 10;
      const m = 5;
      expect(JobScheduleDTOUtils.getNextRunningDate(refDate, {
        trigger: {
          type: JobTriggerType.periodic,
          atTime: (h * 60 + m),
          periodicity: 7
        }
      } as any)).to.be.deep.equal((new Date(Date.UTC(2019, 7, 18, h, m, 0))));
    }
    {
      const h = 2;
      const m = 5;
      expect(JobScheduleDTOUtils.getNextRunningDate(refDate, {
        trigger: {
          type: JobTriggerType.periodic,
          atTime: (h * 60 + m),
          periodicity: 7
        }
      } as any)).to.be.deep.equal((new Date(Date.UTC(2019, 7, 19, h, m, 0))));
    }
  });
});
