import type {Mock} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {BsModalService} from 'ngx-bootstrap/modal';
import {JobButtonComponent} from './job-button.settings.component';
import {ScheduledJobsService} from '../../scheduled-jobs.service';
import {NotificationService} from '../../../../model/notification.service';
import {BackendtextService} from '../../../../model/backendtext.service';
import {JobDTOUtils} from '../../../../../../common/entities/job/JobDTO';
import {JobProgressStates, OnTimerJobProgressDTO} from '../../../../../../common/entities/job/JobProgressDTO';
import {provideIcons} from '@ng-icons/core';
import {appIcons} from '../../../../icons';

describe('JobButtonComponent', () => {
  let jobsService: {
    progress: { value: Record<string, OnTimerJobProgressDTO> },
    getDefaultConfig: Mock
  };

  const createComponent = (inputs: { config?: unknown } = {}): JobButtonComponent => {
    const fixture = TestBed.createComponent(JobButtonComponent);
    fixture.componentRef.setInput('jobName', 'Indexing');
    if (inputs.config) {
      fixture.componentRef.setInput('config', inputs.config);
    }
    return fixture.componentInstance;
  };

  beforeEach(() => {
    jobsService = {
      progress: {value: {}},
      getDefaultConfig: vi.fn()
    };
    TestBed.configureTestingModule({
      imports: [JobButtonComponent],
      providers: [
        provideIcons(appIcons),
        {provide: ScheduledJobsService, useValue: jobsService},
        {provide: NotificationService, useValue: null},
        {provide: BsModalService, useValue: null},
        {provide: BackendtextService, useValue: null},
      ]
    });
  });

  it('should not fail without a config and without a default config', () => {
    jobsService.getDefaultConfig.mockReturnValue(null);
    const component = createComponent();
    expect(component.Progress).toBeUndefined();
    expect(component.Running).toBeFalsy();
  });

  it('should look up the progress with the default config if the config is not set', () => {
    const defaultConfig = {indexChangesOnly: true};
    jobsService.getDefaultConfig.mockReturnValue(defaultConfig);
    const progress = {state: JobProgressStates.running} as OnTimerJobProgressDTO;
    jobsService.progress.value[JobDTOUtils.getHashName('Indexing', defaultConfig)] = progress;
    const component = createComponent();
    expect(component.Progress).toBe(progress);
    expect(component.Running).toBe(true);
  });

  it('should prefer the config input over the default config', () => {
    jobsService.getDefaultConfig.mockReturnValue({indexChangesOnly: true});
    const config = {indexChangesOnly: false};
    const progress = {state: JobProgressStates.running} as OnTimerJobProgressDTO;
    jobsService.progress.value[JobDTOUtils.getHashName('Indexing', config)] = progress;
    const component = createComponent({config});
    expect(component.Progress).toBe(progress);
  });
});
