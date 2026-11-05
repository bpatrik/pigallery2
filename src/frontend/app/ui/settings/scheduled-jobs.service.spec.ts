import {TestBed} from '@angular/core/testing';
import {ScheduledJobsService} from './scheduled-jobs.service';
import {NetworkService} from '../../model/network/network.service';
import {NotificationService} from '../../model/notification.service';
import {BackendtextService} from '../../model/backendtext.service';
import {JobProgressDTO, JobProgressStates} from '../../../../common/entities/job/JobProgressDTO';
import {JobDTOUtils} from '../../../../common/entities/job/JobDTO';

describe('ScheduledJobsService', () => {

  const progressOf = (jobName: string, state: JobProgressStates): JobProgressDTO => ({
    jobName,
    HashName: JobDTOUtils.getHashName(jobName, undefined),
    state,
    logs: [],
    steps: {all: 10, processed: 1, skipped: 0},
    time: {start: 0, end: 1000},
  });

  const setUp = () => {
    let serverProgress: Record<string, JobProgressDTO> = {};
    const networkService = {
      getJson: vi.fn().mockImplementation(() => Promise.resolve(serverProgress)),
      postJson: vi.fn().mockResolvedValue(undefined),
    };
    const notification = {success: vi.fn(), warning: vi.fn()};
    TestBed.configureTestingModule({
      providers: [
        {provide: NetworkService, useValue: networkService},
        {provide: NotificationService, useValue: notification},
        {provide: BackendtextService, useValue: {getJobName: (n: string) => n}},
      ]
    });
    const service = TestBed.inject(ScheduledJobsService);
    const setServerProgress = (p: Record<string, JobProgressDTO>) => serverProgress = p;
    return {service, networkService, notification, setServerProgress};
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should load the progress into the signal and notify when a job finishes', async () => {
    const {service, networkService, notification, setServerProgress} = setUp();
    const finished: string[] = [];
    service.onJobFinish.subscribe(n => finished.push(n));
    const running = progressOf('Indexing', JobProgressStates.running);
    setServerProgress({[running.HashName]: running});

    service.subscribeToProgress();
    await vi.advanceTimersByTimeAsync(0);

    expect(networkService.getJson).toHaveBeenCalledWith('/admin/jobs/scheduled/progress');
    const first = service.progress();
    expect(first[running.HashName].state).toBe(JobProgressStates.running);
    expect(finished).toEqual([]);

    const done = progressOf('Indexing', JobProgressStates.finished);
    setServerProgress({[done.HashName]: done});
    // no job was known to run when polling started, so the next poll comes after 15s
    await vi.advanceTimersByTimeAsync(15000);

    expect(service.progress()).not.toBe(first);
    expect(service.progress()[done.HashName].state).toBe(JobProgressStates.finished);
    expect(finished).toEqual([done.HashName]);
    expect(notification.success).toHaveBeenCalledTimes(1);

    service.unsubscribeFromProgress();
  });

  it('should stop polling after unsubscribing', async () => {
    const {service, networkService} = setUp();
    service.subscribeToProgress();
    await vi.advanceTimersByTimeAsync(0);
    expect(networkService.getJson).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15000);
    expect(networkService.getJson).toHaveBeenCalledTimes(2);

    service.unsubscribeFromProgress();
    await vi.advanceTimersByTimeAsync(60000);
    expect(networkService.getJson).toHaveBeenCalledTimes(2);
  });

  it('should track starting jobs and add a placeholder progress immutably', async () => {
    const {service, networkService} = setUp();
    let resolvePost: () => void;
    networkService.postJson.mockImplementation(() => new Promise<void>(r => resolvePost = r));
    // keep the progress reload after start pending, so the placeholder stays visible
    networkService.getJson.mockReturnValue(new Promise(() => undefined));
    const before = service.progress();

    const starting = service.start('Indexing');
    expect(service.jobStartingStopping()).toEqual({Indexing: true});

    resolvePost();
    await starting;

    expect(service.jobStartingStopping()).toEqual({});
    expect(service.progress()).not.toBe(before);
    expect(before).toEqual({});
    expect(service.progress()[JobDTOUtils.getHashName('Indexing', undefined)].state)
      .toBe(JobProgressStates.running);
  });
  it('should count a job finished when it is gone from the new progress', async () => {
    const {service, networkService, notification} = setUp();
    const finished: string[] = [];
    service.onJobFinish.subscribe(n => finished.push(n));
    // keep the reload right after the start pending, so only the placeholder progress is known
    networkService.getJson.mockReturnValueOnce(new Promise(() => undefined));
    await service.start('Indexing');

    // a quick job is already done and dropped from the server's progress
    await service.forceUpdate();

    const hashName = JobDTOUtils.getHashName('Indexing', undefined);
    expect(service.progress()).toEqual({});
    expect(finished).toEqual([hashName]);
    expect(notification.success).toHaveBeenCalledTimes(1);
    expect(notification.warning).not.toHaveBeenCalled();
  });
});
