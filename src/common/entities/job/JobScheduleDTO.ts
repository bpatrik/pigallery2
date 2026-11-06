/* eslint-disable no-case-declarations */
import {MediaPickDTO} from '../MediaPickDTO';

export enum JobTriggerType {
  never = 1,
  scheduled = 2,
  periodic = 3,
  after = 4,
}

export interface JobTrigger {
  type: JobTriggerType;
}

export interface NeverJobTrigger extends JobTrigger {
  type: JobTriggerType.never;
}

export interface ScheduledJobTrigger extends JobTrigger {
  type: JobTriggerType.scheduled;
  time: number; // data time
}

export interface PeriodicJobTrigger extends JobTrigger {
  type: JobTriggerType.periodic;
  periodicity: number | undefined; // 0-6: week days 7 every day
  atTime: number | undefined; // day time min value: 0, max: 23*60+59
}

export interface AfterJobTrigger extends JobTrigger {
  type: JobTriggerType.after;
  afterScheduleName: string | undefined; // runs after schedule
}

export interface JobScheduleDTO {
  name: string;
  jobName: string;
  config: Record<string, string | number | string[] | number[] | MediaPickDTO[]>;
  allowParallelRun: boolean;
  trigger:
      | NeverJobTrigger
      | ScheduledJobTrigger
      | PeriodicJobTrigger
      | AfterJobTrigger;
}

export const JobScheduleDTOUtils = {
  getNextDayOfTheWeek: (refDate: Date, dayOfWeek: number): Date => {
    const date = new Date(refDate);
    date.setDate(
        refDate.getDate() + ((dayOfWeek + 1 + 7 - refDate.getDay()) % 7)
    );
    if (date.getDay() === refDate.getDay()) {
      return new Date(refDate);
    }
    date.setUTCHours(0, 0, 0, 0);
    return date;
  },

  nextValidDate: (date: Date, h: number, m: number, dayDiff: number): Date => {
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
    if (
        date.getUTCHours() < h ||
        (date.getUTCHours() === h && date.getUTCMinutes() < m)
    ) {
      date.setUTCHours(h);
      date.setUTCMinutes(m);
    } else {
      date.setTime(date.getTime() + dayDiff);
      date.setUTCHours(h);
      date.setUTCMinutes(m);
    }
    return date;
  },

  getNextRunningDate: (refDate: Date, schedule: JobScheduleDTO): Date | null => {
    switch (schedule.trigger.type) {
      case JobTriggerType.scheduled:
        return new Date(schedule.trigger.time);

      case JobTriggerType.periodic: {
        // the defaults of PeriodicJobTriggerConfig
        const atTime = schedule.trigger.atTime ?? 0;
        const periodicity = schedule.trigger.periodicity ?? 7;
        const hour = Math.min(23, Math.floor(atTime / 60));
        const minute = atTime % 60;

        if (periodicity <= 6) {
          // Between Monday and Sunday
          const nextRunDate = JobScheduleDTOUtils.getNextDayOfTheWeek(
              refDate,
              periodicity
          );
          return JobScheduleDTOUtils.nextValidDate(
              nextRunDate,
              hour,
              minute,
              7 * 24 * 60 * 60 * 1000
          );
        }

        // every day
        return JobScheduleDTOUtils.nextValidDate(
            new Date(refDate),
            hour,
            minute,
            24 * 60 * 60 * 1000
        );
      }
    }
    return null;
  },
};
