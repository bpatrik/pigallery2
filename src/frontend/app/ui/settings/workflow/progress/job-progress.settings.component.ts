import { Component, OnChanges, OnDestroy, TemplateRef, inject, input } from '@angular/core';
import {JobProgressDTO, JobProgressStates,} from '../../../../../../common/entities/job/JobProgressDTO';
import {Subscription, timer} from 'rxjs';
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
export class JobProgressComponent implements OnDestroy, OnChanges {
  private modalService = inject(BsModalService);
  backendTextService = inject(BackendtextService);

  readonly progress = input<JobProgressDTO>(undefined);
  JobProgressStates = JobProgressStates;
  timeCurrentCopy: number;
  modalRef: BsModalRef;
  private timerSub: Subscription;

  get ProgressTitle(): string {
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
  }

  get Name(): string {
    const progress = this.progress();
    if (!progress) {
      return '';
    }
    return this.backendTextService.getJobName(progress.jobName);
  }

  get TimeAll(): number {
    const progress = this.progress();
    if (!progress || progress.steps.processed === 0) {
      return 0;
    }
    return (
        ((progress.time.end - progress.time.start) /
            progress.steps.processed) *
        (progress.steps.all - progress.steps.skipped)
    );
  }

  get Running(): boolean {
    const progress = this.progress();
    return (
        progress &&
        (progress.state === JobProgressStates.running ||
            progress.state === JobProgressStates.cancelling)
    );
  }

  get Stopped(): boolean {
    const progress = this.progress();
    return (
        progress &&
        progress.state !== JobProgressStates.running &&
        progress.state !== JobProgressStates.cancelling
    );
  }

  get TimeLeft(): number {
    const progress = this.progress();
    if (!progress) {
      return 0;
    }
    return (
        (progress.time.end - progress.time.start) /
        progress.steps.all
    );
  }

  get TimeElapsed(): number {
    const progress = this.progress();
    if (!progress) {
      return 0;
    }
    return this.timeCurrentCopy - progress.time.start;
  }

  get State(): string {
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
  }

  openModal(template: TemplateRef<unknown>): void {
    this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
  }

  // Side effect: starts the timer that counts the elapsed job time.
  ngOnChanges(): void {
    const progress = this.progress();
    if (!progress) {
      return;
    }
    this.timeCurrentCopy = progress.time.end;
    if (!this.timerSub) {
      this.timerSub = timer(0, 1000).subscribe(() => {
        if (this.progress()) {
          this.timeCurrentCopy += 1000;
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
    }
  }
}



