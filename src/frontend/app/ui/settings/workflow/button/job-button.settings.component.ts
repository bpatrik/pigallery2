import { Component, TemplateRef, inject, input, output } from '@angular/core';
import {JobProgressStates, OnTimerJobProgressDTO,} from '../../../../../../common/entities/job/JobProgressDTO';
import {ErrorDTO} from '../../../../../../common/entities/Error';
import {ScheduledJobsService} from '../../scheduled-jobs.service';
import {NotificationService} from '../../../../model/notification.service';
import {JobDTOUtils} from '../../../../../../common/entities/job/JobDTO';
import {BackendtextService} from '../../../../model/backendtext.service';
import {BsModalRef,BsModalService} from 'ngx-bootstrap/modal';
import {ConfigStyle} from '../../settings.service';

import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-settings-job-button',
    templateUrl: './job-button.settings.component.html',
    styleUrl: './job-button.settings.component.css',
    imports: [NgIconComponent]
})
export class JobButtonComponent {
  private notification = inject(NotificationService);
  jobsService = inject(ScheduledJobsService);
  private modalService = inject(BsModalService);
  backendTextService = inject(BackendtextService);

  readonly jobName = input<string>(undefined);
  readonly config = input<any>(undefined);
  readonly shortName = input(false);
  readonly disabled = input(false);
  readonly soloRun = input(false);
  readonly allowParallelRun = input(false);
  readonly danger = input(false);
  JobProgressStates = JobProgressStates;
  readonly jobError = output<string>();
  private modalRef: BsModalRef;
  private defaultConfig: any;

  /**
   * The config input, or the job's default config if the input is not set.
   */
  private get Config(): any {
    if (this.config()) {
      return this.config();
    }
    if (!this.defaultConfig) {
      // can return with null, keep undefined then, so JobDTOUtils.getHashName uses its default config
      const c = this.jobsService.getDefaultConfig(this.jobName());
      if (c) {
        this.defaultConfig = c;
      }
    }
    return this.defaultConfig;
  }

  public get Running(): boolean {
    return (
      this.Progress &&
      (this.Progress.state === JobProgressStates.running ||
        this.Progress.state === JobProgressStates.cancelling)
    );
  }

  get Progress(): OnTimerJobProgressDTO {
    return this.jobsService.progress.value[
      JobDTOUtils.getHashName(this.jobName(), this.Config)
      ];
  }


  public hideModal(): void {
    this.modalRef.hide();
    this.modalRef = null;
  }

  public async openModal(template: TemplateRef<unknown>): Promise<void> {
    // if we show the button in short form (at the jobs settings),
    // we assume users know what they are doing,
    // so we do not show a confirm window.
    if(this.shortName()){
      await this.start();
      return;
    }
    this.modalRef = this.modalService.show(template, {
      class: 'modal-lg',
    });
    document.body.style.paddingRight = '0px';
  }



  public async start(): Promise<boolean> {
    this.jobError.emit('');
    try {
      await this.jobsService.start(
        this.jobName(),
        this.Config,
        this.soloRun(),
        this.allowParallelRun()
      );
      this.notification.success(
        $localize`Job started` +
        ': ' +
        this.backendTextService.getJobName(this.jobName())
      );
      return true;
    } catch (err) {
      console.log(err);
      if (err.message) {
        this.jobError.emit((err as ErrorDTO).message);
      }
    }

    return false;
  }

  public async stop(): Promise<boolean> {
    this.jobError.emit('');
    try {
      await this.jobsService.stop(this.jobName());
      this.notification.info(
        $localize`Stopping job` +
        ': ' +
        this.backendTextService.getJobName(this.jobName())
      );
      return true;
    } catch (err) {
      console.error(err);
      if (err.message) {
        this.jobError.emit((err as ErrorDTO).message);
      }
    }
    return false;
  }

  protected readonly ConfigStyle = ConfigStyle;
}



