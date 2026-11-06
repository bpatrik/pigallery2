import {TestBed} from '@angular/core/testing';
import {BsModalService} from 'ngx-bootstrap/modal';
import {JobProgressComponent} from './job-progress.settings.component';
import {BackendtextService} from '../../../../model/backendtext.service';
import {JobProgressDTO, JobProgressStates} from '../../../../../../common/entities/job/JobProgressDTO';

describe('JobProgressComponent', () => {
  const createProgress = (state: JobProgressStates): JobProgressDTO => ({
    jobName: 'Indexing',
    HashName: 'Indexing',
    state,
    logs: [],
    steps: {all: 10, processed: 2, skipped: 2},
    time: {start: 1000, end: 3000}
  });

  const setUp = (progress: JobProgressDTO | undefined) => {
    TestBed.configureTestingModule({
      imports: [JobProgressComponent],
      providers: [
        {provide: BsModalService, useValue: null},
        {provide: BackendtextService, useValue: {getJobName: (n: string) => 'name of ' + n}},
      ]
    });
    // only the derived state is tested here
    TestBed.overrideComponent(JobProgressComponent, {set: {template: '', imports: []}});
    const fixture = TestBed.createComponent(JobProgressComponent);
    fixture.componentRef.setInput('progress', progress);
    return {component: fixture.componentInstance, fixture};
  };

  it('should derive the state of a running job', () => {
    const {component} = setUp(createProgress(JobProgressStates.running));
    expect(component.Running()).toBe(true);
    expect(component.Stopped()).toBe(false);
    expect(component.State()).toBe('running');
    expect(component.Name()).toBe('name of Indexing');
    expect(component.ProgressTitle()).toBe('processed:2 + skipped:2 / all:10');
    // (end - start) / processed * (all - skipped)
    expect(component.TimeAll()).toBe(8000);
    expect(component.TimeElapsed()).toBe(2000);
  });

  it('should follow a new progress', () => {
    const {component, fixture} = setUp(createProgress(JobProgressStates.running));
    fixture.componentRef.setInput('progress', createProgress(JobProgressStates.finished));
    expect(component.Running()).toBe(false);
    expect(component.Stopped()).toBe(true);
    expect(component.State()).toBe('finished');
  });

  it('should handle a missing progress', () => {
    const {component} = setUp(undefined);
    expect(component.Running()).toBe(false);
    expect(component.Stopped()).toBe(false);
    expect(component.State()).toBe('');
    expect(component.Name()).toBe('');
    expect(component.TimeAll()).toBe(0);
    expect(component.TimeElapsed()).toBe(0);
  });
});
