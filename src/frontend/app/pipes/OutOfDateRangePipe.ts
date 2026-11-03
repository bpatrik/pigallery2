import {Pipe, PipeTransform} from '@angular/core';

/**
 * True if the [date, endDate] period is outside the [min, max] timestamps.
 */
@Pipe({
  name: 'outOfDateRange'
})
export class OutOfDateRangePipe implements PipeTransform {
  transform(period: { date: Date, endDate: Date }, min: number, max: number): boolean {
    return period.endDate.getTime() < min || period.date.getTime() > max;
  }
}
