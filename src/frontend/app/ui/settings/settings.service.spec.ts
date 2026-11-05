import {Subject} from 'rxjs';
import {TestBed} from '@angular/core/testing';
import {SettingsService} from './settings.service';
import {NetworkService} from '../../model/network/network.service';
import {ScheduledJobsService} from './scheduled-jobs.service';
import {StatisticDTO} from '../../../../common/entities/settings/StatisticDTO';
import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';

describe('SettingsService', () => {

  const setUp = () => {
    const statistic = {directories: 1, photos: 2} as StatisticDTO;
    const networkService = {
      getJson: vi.fn().mockImplementation((url: string) => {
        if (url === '/settings') {
          return Promise.resolve({Users: {authenticationRequired: false}});
        }
        if (url === '/admin/statistic') {
          return Promise.resolve(statistic);
        }
        return Promise.resolve(null);
      }),
    };
    const jobsService = {onJobFinish: new Subject<string>()};
    TestBed.configureTestingModule({
      providers: [
        {provide: NetworkService, useValue: networkService},
        {provide: ScheduledJobsService, useValue: jobsService},
      ]
    });
    const service = TestBed.inject(SettingsService);
    return {service, networkService, jobsService, statistic};
  };

  it('should set the settings and the statistic signals after loading', async () => {
    const {service, networkService, statistic} = setUp();
    const initial = service.settings();
    expect(initial.Users.authenticationRequired).toBe(true);

    await vi.waitFor(() => expect(service.settings()).not.toBe(initial));

    expect(networkService.getJson).toHaveBeenCalledWith('/settings');
    expect(service.settings().Users.authenticationRequired).toBe(false);
    expect(service.statistic()).toEqual(statistic);
  });

  it('should reload the statistic when indexing finished', async () => {
    const {service, networkService, jobsService} = setUp();
    await vi.waitFor(() => expect(service.statistic()).not.toBeNull());
    networkService.getJson.mockClear();

    jobsService.onJobFinish.next(DefaultsJobs[DefaultsJobs['Video Converting']]);
    expect(networkService.getJson).not.toHaveBeenCalled();

    jobsService.onJobFinish.next(DefaultsJobs[DefaultsJobs.Indexing]);
    expect(networkService.getJson).toHaveBeenCalledWith('/admin/statistic');
  });
});
