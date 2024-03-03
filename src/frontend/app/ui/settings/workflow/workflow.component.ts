import {Component, forwardRef, OnDestroy, OnInit, QueryList, ViewChildren} from '@angular/core';
import {ModalDirective} from 'ngx-bootstrap/modal';
import {
  AfterJobTrigger,
  JobScheduleDTO,
  JobScheduleDTOUtils,
  JobTriggerType,
  ScheduledJobTrigger
} from '../../../../../common/entities/job/JobScheduleDTO';
import {ScheduledJobsService} from '../scheduled-jobs.service';
import {BackendtextService} from '../../../model/backendtext.service';
import {ConfigStyle, SettingsService} from '../settings.service';
import {JobProgressDTO, JobProgressStates} from '../../../../../common/entities/job/JobProgressDTO';
import {
  AfterJobTriggerConfig,
  JobScheduleConfig,
  NeverJobTriggerConfig,
  PeriodicJobTriggerConfig,
  ScheduledJobTriggerConfig
} from '../../../../../common/config/private/PrivateConfig';
import {ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';
import {SortByTypes, SortingMethod} from '../../../../../common/entities/SortingMethods';
import {MediaPickDTO} from '../../../../../common/entities/MediaPickDTO';
import {SearchQueryTypes, TextSearch} from '../../../../../common/entities/SearchQueryDTO';

@Component({
  selector: 'app-settings-workflow',
  templateUrl: './workflow.component.html',
  styleUrls: ['./workflow.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => WorkflowComponent),
      multi: true,
    },

    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => WorkflowComponent),
      multi: true,
    },
  ],
})
export class WorkflowComponent implements ControlValueAccessor, Validator, OnInit, OnDestroy {


  public schedules: JobScheduleConfig[] = [];

  @ViewChildren('jobModal') public jobModalQL: QueryList<ModalDirective>;

  public disableButtons = false;
  public JobTriggerTypeMap: { key: number; value: string }[];
  public JobTriggerType = JobTriggerType;
  public periods: string[] = [];
  public showDetails: { [key: string]: boolean } = {};
  public JobProgressStates = JobProgressStates;
  public newSchedule: JobScheduleDTO = {
    name: '',
    config: null,
    jobName: '',
    trigger: {
      type: JobTriggerType.never,
    },
    allowParallelRun: false,
  };
  public readonly ConfigStyle = ConfigStyle;
  protected readonly SortByTypes = SortByTypes;


  error: string;

  constructor(
    public settingsService: SettingsService,
    public jobsService: ScheduledJobsService,
    public backendTextService: BackendtextService,
  ) {
    this.JobTriggerTypeMap = [
      {key: JobTriggerType.after, value: $localize`after`},
      {key: JobTriggerType.never, value: $localize`never`},
      {key: JobTriggerType.periodic, value: $localize`periodic`},
      {key: JobTriggerType.scheduled, value: $localize`scheduled`},
    ];
    this.periods = [
      $localize`Monday`, // 0
      $localize`Tuesday`, // 1
      $localize`Wednesday`, // 2
      $localize`Thursday`,
      $localize`Friday`,
      $localize`Saturday`,
      $localize`Sunday`,
      $localize`day`,
    ]; // 7


  }

  atTimeLocal(atTime: number): Date {
    if (!atTime) {
      return null;
    }
    const d = new Date();
    d.setUTCHours(Math.floor(atTime / 60));
    d.setUTCMinutes(Math.floor(atTime % 60));
    return d;
  }


  ngOnInit(): void {
    this.jobsService.subscribeToProgress();
    this.jobsService.getAvailableJobs().catch(console.error);
    this.jobsService.getAvailableMessengers().catch(console.error);
  }

  ngOnDestroy(): void {
    this.jobsService.unsubscribeFromProgress();
  }

  remove(schedule: JobScheduleDTO): void {
    this.schedules.splice(
      this.schedules.indexOf(schedule),
      1
    );
  }

  jobTypeChanged(schedule: JobScheduleDTO): void {
    const job = this.jobsService.availableJobs.value.find(
      (t) => t.Name === schedule.jobName
    );
    schedule.config = schedule.config || {};
    if (job.ConfigTemplate) {
      job.ConfigTemplate.forEach(
        (ct) => (schedule.config[ct.id] = ct.defaultValue as never)
      );
    }
  }


  jobTriggerTypeChanged(
    triggerType: JobTriggerType,
    schedule: JobScheduleDTO
  ): void {
    switch (triggerType) {
      case JobTriggerType.never:
        schedule.trigger = new NeverJobTriggerConfig();
        break;
      case JobTriggerType.scheduled:
        schedule.trigger = new ScheduledJobTriggerConfig();
        (schedule.trigger as unknown as ScheduledJobTrigger).time = Date.now();
        break;

      case JobTriggerType.periodic:
        schedule.trigger = new PeriodicJobTriggerConfig();
        schedule.trigger.periodicity = 7;
        schedule.trigger.atTime = 0;
        break;

      case JobTriggerType.after:
        schedule.trigger = new AfterJobTriggerConfig();
        if (!(schedule.trigger as unknown as AfterJobTrigger).afterScheduleName && this.schedules.length > 1) {
          (schedule.trigger as unknown as AfterJobTrigger).afterScheduleName = this.schedules.find(s => s.name !== schedule.name).name;
        }
        break;
    }
  }

  setEmailArray(configElement: any, id: string, value: string): void {
    value = value.replace(new RegExp(',', 'g'), ';');
    value = value.replace(new RegExp(' ', 'g'), ';');
    configElement[id] = value
      .split(';').filter((i: string) => i != '');
  }

  getArray(configElement: Record<string, number[]>, id: string): string {
    return configElement[id] && Array.isArray(configElement[id]) ? configElement[id].join('; ') : '';
  }

  setNumberArray(configElement: any, id: string, value: string): void {
    value = value.replace(new RegExp(',', 'g'), ';');
    value = value.replace(new RegExp(' ', 'g'), ';');
    configElement[id] = value
      .split(';')
      .map((s: string) => parseInt(s, 10))
      .filter((i: number) => !isNaN(i) && i > 0);
  }


  public shouldIdent(curr: JobScheduleDTO, prev: JobScheduleDTO): boolean {
    return (
      curr &&
      curr.trigger.type === JobTriggerType.after &&
      prev &&
      prev.name === curr.trigger.afterScheduleName
    );
  }

  public sortedSchedules(): JobScheduleDTO[] {
    return (this.schedules || [])
      .slice()
      .sort((a: JobScheduleDTO, b: JobScheduleDTO) => {
        return (
          this.getNextRunningDate(a, this.schedules) -
          this.getNextRunningDate(b, this.schedules)
        );
      });
  }

  prepareNewJob(): void {
    const jobName = this.jobsService.availableJobs.value[0].Name;
    this.newSchedule = new JobScheduleConfig('new job',
      jobName,
      new NeverJobTriggerConfig());

    // setup job specific config
    const job = this.jobsService.availableJobs.value.find(
      (t) => t.Name === jobName
    );
    this.newSchedule.config = this.newSchedule.config || {};
    if (job.ConfigTemplate) {
      job.ConfigTemplate.forEach(
        (ct) => (this.newSchedule.config[ct.id] = ct.defaultValue as never)
      );
    }
    this.jobModalQL.first.show();
  }

  addNewJob(): void {
    // make unique job name
    const jobName = this.newSchedule.jobName;
    const count = this.schedules.filter(
      (s: JobScheduleDTO) => s.jobName === jobName
    ).length;
    this.newSchedule.name =
      count === 0
        ? jobName
        : this.backendTextService.getJobName(jobName) + ' ' + (count + 1);
    this.schedules.push(this.newSchedule);

    this.jobModalQL.first.hide();
    this.onChange(null); // trigger change detection after adding new job
  }

  getProgress(schedule: JobScheduleDTO): JobProgressDTO {
    return this.jobsService.getProgress(schedule);
  }

  private getNextRunningDate(
    sch: JobScheduleDTO,
    list: JobScheduleDTO[],
    depth = 0
  ): number {
    if (depth > list.length) {
      return 0;
    }
    if (sch.trigger.type === JobTriggerType.never) {
      return (
        list
          .map((s) => s.name)
          .sort()
          .indexOf(sch.name) * -1
      );
    }
    if (sch.trigger.type === JobTriggerType.after) {
      const parent = list.find(
        (s) => s.name === (sch.trigger as AfterJobTrigger).afterScheduleName
      );
      if (parent) {
        return this.getNextRunningDate(parent, list, depth + 1) + 0.001;
      }
    }
    const d = JobScheduleDTOUtils.getNextRunningDate(new Date(), sch);
    return d !== null ? d.getTime() : 0;
  }

  validate(): ValidationErrors {
    return null;
  }

  public onChange = (value: unknown): void => {
    // empty
  };

  public onTouched = (): void => {
    // empty
  };

  getJobDescription(jobName: string): string {
    return this.backendTextService.getJobDescription(jobName);
  }

  public writeValue(obj: JobScheduleConfig[]): void {
    this.schedules = obj;
  }

  public registerOnChange(fn: (v: JobScheduleConfig[]) => void): void {
    this.onChange = () => fn(this.schedules);
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }


  AsMediaPickDTOArray(configElement: string | number | string[] | number[] | MediaPickDTO[]): MediaPickDTO[] {
    return configElement as MediaPickDTO[];
  }

  removeFromArray(configElement: any[], i: number): void {
    configElement.splice(i, 1);
  }

  AddNewSorting(configElement: string | number | string[] | number[] | MediaPickDTO[] | SortingMethod[]): void {
    (configElement as SortingMethod[]).push({method: SortByTypes.Date, ascending: true});
  }

  AddNewMediaPickDTO(configElement: string | number | string[] | number[] | MediaPickDTO[]): void {
    (configElement as MediaPickDTO[]).push({
      searchQuery: {type: SearchQueryTypes.any_text, text: ''} as TextSearch,
      sortBy: [{method: SortByTypes.Rating, ascending: true},
        {method: SortByTypes.PersonCount, ascending: true}],
      pick: 5
    });
  }

}
