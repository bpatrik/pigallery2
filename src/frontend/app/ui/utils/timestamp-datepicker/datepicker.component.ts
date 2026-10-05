import {Component, EventEmitter, Input, Output, ChangeDetectionStrategy} from '@angular/core';
import { BsDatepickerInputDirective, BsDatepickerDirective } from 'ngx-bootstrap/datepicker';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-timestamp-datepicker',
    templateUrl: './datepicker.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        BsDatepickerInputDirective,
        FormsModule,
        BsDatepickerDirective,
    ]
})
export class TimeStampDatePickerComponent {
  timestampValue = 0;
  @Output() timestampChange = new EventEmitter<number>();

  date: Date = new Date();
  @Input() name: string;

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



