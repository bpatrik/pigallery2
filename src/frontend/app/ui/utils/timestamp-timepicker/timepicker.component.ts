import {Component, EventEmitter, Input, Output, ChangeDetectionStrategy} from '@angular/core';
import { TimepickerComponent } from 'ngx-bootstrap/timepicker';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-timestamp-timepicker',
    templateUrl: './timepicker.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [TimepickerComponent, FormsModule]
})
export class TimeStampTimePickerComponent {
  timestampValue = 0;
  @Output() timestampChange = new EventEmitter<number>();

  date: Date = new Date();
  @Input() name: string;

  constructor() {
    this.date.setUTCSeconds(0);
    this.date.setUTCMilliseconds(0);
  }

  @Input()
  public get timestamp(): number {
    return this.timestampValue;
  }

  public set timestamp(val: number) {
    const h = Math.min(23, Math.floor(val / 60));
    const m = val % 60;
    this.date.setUTCHours(h);
    this.date.setUTCMinutes(m);

    if (this.timestampValue === val) {
      return;
    }
    this.timestampValue = val;
    this.timestampChange.emit(this.timestampValue);
  }

  onChange(date: Date | string): void {
    const d = new Date(date);
    this.timestamp = d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}



