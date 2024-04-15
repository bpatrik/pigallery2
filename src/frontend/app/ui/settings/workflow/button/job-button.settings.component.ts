import {Component, EventEmitter, Input, Output, TemplateRef} from '@angular/core';
import {JobProgressStates, OnTimerJobProgressDTO,} from '../../../../../../common/entities/job/JobProgressDTO';
import {ErrorDTO} from '../../../../../../common/entities/Error';
import {ScheduledJobsService} from '../../scheduled-jobs.service';
import {NotificationService} from '../../../../model/notification.service';
import {JobDTOUtils} from '../../../../../../common/entities/job/JobDTO';
import {BackendtextService} from '../../../../model/backendtext.service';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {BsModalService} from '../../../../../../../node_modules/ngx-bootstrap/modal';
import {ConfigStyle} from '../../settings.service';

@Component({
  selector: 'app-settings-job-button',
  templateUrl: './job-button.settings.component.html',
  styleUrls: ['./job-button.settings.component.css'],
})
export class JobButtonComponent {
  @Input() jobName: string;
  @Input() config: any;
  @Input() shortName = false;
  @Input() disabled = false;
  @Input() soloRun = false;
  @Input() allowParallelRun = false;
  @Input() danger = false;
  JobProgressStates = JobProgressStates;
  @Output() jobError = new EventEmitter<string>();
  private modalRef: BsModalRef;

  constructor(
    private notification: NotificationService,
    public jobsService: ScheduledJobsService,
    private modalService: BsModalService,
    public backendTextService: BackendtextService
  ) {
  }

  private populateConfig() {
    if (this.config) {
      return;
    }
    const c = this.jobsService.getDefaultConfig(this.jobName); // can return with null
    if (c) {
      this.config = c;
    }
  }

  public get Running(): boolean {
    return (
      this.Progress &&
      (this.Progress.state === JobProgressStates.running ||
        this.Progress.state === JobProgressStates.cancelling)
    );
  }

  get Progress(): OnTimerJobProgressDTO {
    this.populateConfig();
    return this.jobsService.progress.value[
      JobDTOUtils.getHashName(this.jobName, this.config)
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
    if(this.shortName){
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
    this.populateConfig();
    try {
      await this.jobsService.start(
        this.jobName,
        this.config,
        this.soloRun,
        this.allowParallelRun
      );
      this.notification.success(
        $localize`Job started` +
        ': ' +
        this.backendTextService.getJobName(this.jobName)
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
      await this.jobsService.stop(this.jobName);
      this.notification.info(
        $localize`Stopping job` +
        ': ' +
        this.backendTextService.getJobName(this.jobName)
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



