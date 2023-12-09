import {Component, Input, OnChanges, OnDestroy, TemplateRef,} from '@angular/core';
import {JobProgressDTO, JobProgressStates,} from '../../../../../../common/entities/job/JobProgressDTO';
import {Subscription, timer} from 'rxjs';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {BackendtextService} from '../../../../model/backendtext.service';

@Component({
  selector: 'app-settings-job-progress',
  templateUrl: './job-progress.settings.component.html',
  styleUrls: ['./job-progress.settings.component.css'],
})
export class JobProgressComponent implements OnDestroy, OnChanges {
  @Input() progress: JobProgressDTO;
  JobProgressStates = JobProgressStates;
  timeCurrentCopy: number;
  modalRef: BsModalRef;
  private timerSub: Subscription;

  constructor(
      private modalService: BsModalService,
      public backendTextService: BackendtextService
  ) {
  }

  get ProgressTitle(): string {
    if (!this.progress) {
      return '';
    }
    return (
        $localize`processed` +
        ':' +
        this.progress.steps.processed +
        ' + ' +
        $localize`skipped` +
        ':' +
        this.progress.steps.skipped +
        ' / ' +
        $localize`all` +
        ':' +
        this.progress.steps.all
    );
  }

  get Name(): string {
    if (!this.progress) {
      return '';
    }
    return this.backendTextService.getJobName(this.progress.jobName);
  }

  get TimeAll(): number {
    if (!this.progress || this.progress.steps.processed === 0) {
      return 0;
    }
    return (
        ((this.progress.time.end - this.progress.time.start) /
            this.progress.steps.processed) *
        (this.progress.steps.all - this.progress.steps.skipped)
    );
  }

  get Running(): boolean {
    return (
        this.progress &&
        (this.progress.state === JobProgressStates.running ||
            this.progress.state === JobProgressStates.cancelling)
    );
  }

  get Stopped(): boolean {
    return (
        this.progress &&
        this.progress.state !== JobProgressStates.running &&
        this.progress.state !== JobProgressStates.cancelling
    );
  }

  get TimeLeft(): number {
    if (!this.progress) {
      return 0;
    }
    return (
        (this.progress.time.end - this.progress.time.start) /
        this.progress.steps.all
    );
  }

  get TimeElapsed(): number {
    if (!this.progress) {
      return 0;
    }
    return this.timeCurrentCopy - this.progress.time.start;
  }

  get State(): string {
    if (!this.progress) {
      return '';
    }
    switch (this.progress.state) {
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

  ngOnChanges(): void {
    if (!this.progress) {
      return;
    }
    this.timeCurrentCopy = this.progress.time.end;
    if (!this.timerSub) {
      this.timerSub = timer(0, 1000).subscribe(() => {
        if (this.progress) {
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



