import {Component, TemplateRef, inject, input, linkedSignal, computed} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {JobProgressDTO, JobProgressStates,} from '../../../../../../common/entities/job/JobProgressDTO';
import {timer} from 'rxjs';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {BackendtextService} from '../../../../model/backendtext.service';
import { DecimalPipe, DatePipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { FormsModule } from '@angular/forms';
import { DurationPipe } from '../../../../pipes/DurationPipe';

@Component({
    selector: 'app-settings-job-progress',
    templateUrl: './job-progress.settings.component.html',
    styleUrl: './job-progress.settings.component.css',
    imports: [
    NgIconComponent,
    FormsModule,
    DecimalPipe,
    DatePipe,
    DurationPipe
]
})
export class JobProgressComponent {
  private modalService = inject(BsModalService);
  backendTextService = inject(BackendtextService);

  readonly progress = input<JobProgressDTO>();
  JobProgressStates = JobProgressStates;
  modalRef: BsModalRef;
  // Reset to the job's last reported time on every new progress, then ticks forward every second.
  private readonly timeCurrentCopy = linkedSignal<number | undefined>(() => this.progress()?.time.end);

  constructor() {
    timer(0, 1000).pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.progress()) {
        this.timeCurrentCopy.update(t => t === undefined ? t : t + 1000);
      }
    });
  }

  readonly ProgressTitle = computed<string>(() => {
    const progress = this.progress();
    if (!progress) {
      return '';
    }
    return (
        $localize`processed` +
        ':' +
        progress.steps.processed +
        ' + ' +
        $localize`skipped` +
        ':' +
        progress.steps.skipped +
        ' / ' +
        $localize`all` +
        ':' +
        progress.steps.all
    );
  });

  readonly Name = computed<string | null>(() => {
    const progress = this.progress();
    if (!progress) {
      return '';
    }
    return this.backendTextService.getJobName(progress.jobName);
  });

  readonly TimeAll = computed<number>(() => {
    const progress = this.progress();
    if (!progress || progress.steps.processed === 0) {
      return 0;
    }
    return (
        ((progress.time.end - progress.time.start) /
            progress.steps.processed) *
        (progress.steps.all - progress.steps.skipped)
    );
  });

  readonly Running = computed<boolean>(() => {
    const progress = this.progress();
    return (
        !!progress &&
        (progress.state === JobProgressStates.running ||
            progress.state === JobProgressStates.cancelling)
    );
  });

  readonly Stopped = computed<boolean>(() => {
    const progress = this.progress();
    return (
        !!progress &&
        progress.state !== JobProgressStates.running &&
        progress.state !== JobProgressStates.cancelling
    );
  });

  readonly TimeElapsed = computed<number>(() => {
    const progress = this.progress();
    if (!progress) {
      return 0;
    }
    return (this.timeCurrentCopy() ?? NaN) - progress.time.start;
  });

  readonly State = computed<string>(() => {
    const progress = this.progress();
    if (!progress) {
      return '';
    }
    switch (progress.state) {
      case JobProgressStates.running:
        return $localize`running`;
      case JobProgressStates.cancelling:
        return $localize`cancelling`;
      case JobProgressStates.canceled:
        return $localize`canceled`;
      case JobProgressStates.interrupted:
        return $localize`interrupted`;
      case JobProgressStates.finished:
        return $localize`finished`;
      case JobProgressStates.failed:
        return $localize`failed`;
      default:
        return 'unknown state';
    }
  });

  openModal(template: TemplateRef<unknown>): void {
    this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
  }

}



