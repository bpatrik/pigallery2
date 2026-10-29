import {Component, Input, input, output} from '@angular/core';
import { BsDatepickerInputDirective, BsDatepickerDirective } from 'ngx-bootstrap/datepicker';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-timestamp-datepicker',
    templateUrl: './datepicker.component.html',
    imports: [
        BsDatepickerInputDirective,
        FormsModule,
        BsDatepickerDirective,
    ]
})
export class TimeStampDatePickerComponent {
  timestampValue = 0;
  readonly timestampChange = output<number>();

  date: Date = new Date();
  readonly name = input<string>(undefined);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  public get timestamp(): number {
    return this.timestampValue;
  }

  public set timestamp(val: number) {
    this.date.setTime(val);
    if (this.timestampValue === val) {
      return;
    }
    this.timestampValue = val;
    this.timestampChange.emit(this.timestampValue);
  }

  onChange(date: Date | string): void {
    this.timestamp = new Date(date).getTime();
  }
}



