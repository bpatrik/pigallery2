import {Component, computed, input, model} from '@angular/core';
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
  readonly timestamp = model<number>(0);
  readonly date = computed((): Date => new Date(this.timestamp()));
  readonly name = input<string>(undefined);

  onChange(date: Date | string): void {
    this.timestamp.set(new Date(date).getTime());
  }
}
