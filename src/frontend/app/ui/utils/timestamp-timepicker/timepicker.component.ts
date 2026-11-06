import {Component, computed, input, model} from '@angular/core';
import { TimepickerComponent } from 'ngx-bootstrap/timepicker';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-timestamp-timepicker',
    templateUrl: './timepicker.component.html',
    imports: [TimepickerComponent, FormsModule]
})
export class TimeStampTimePickerComponent {
  /**
   * Minutes since midnight (UTC)
   */
  readonly timestamp = model<number | undefined>(0);
  readonly date = computed((): Date => {
    const val = this.timestamp() ?? 0;
    const date = new Date();
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
    date.setUTCHours(Math.min(23, Math.floor(val / 60)));
    date.setUTCMinutes(val % 60);
    return date;
  });
  readonly name = input<string>();

  onChange(date: Date | string): void {
    const d = new Date(date);
    this.timestamp.set(d.getUTCHours() * 60 + d.getUTCMinutes());
  }
}
