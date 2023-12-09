import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-timestamp-datepicker',
  templateUrl: './datepicker.component.html',
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



