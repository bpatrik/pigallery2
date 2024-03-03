import {Injectable} from '@angular/core';
import {BehaviorSubject, first} from 'rxjs';
import {NetworkService} from '../../model/network/network.service';

import {WebConfig} from '../../../../common/config/private/WebConfig';
import {WebConfigClassBuilder} from 'typeconfig/src/decorators/builders/WebConfigClassBuilder';
import {ConfigPriority, TAGS} from '../../../../common/config/public/ClientConfig';
import {CookieNames} from '../../../../common/CookieNames';
import {CookieService} from 'ngx-cookie-service';
import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import {StatisticDTO} from '../../../../common/entities/settings/StatisticDTO';
import {ScheduledJobsService} from './scheduled-jobs.service';
import {IWebConfigClassPrivate} from 'typeconfig/src/decorators/class/IWebConfigClass';


export enum ConfigStyle {
  full = 1, compact
}


@Injectable()
export class SettingsService {
  public configPriority = ConfigPriority.basic;
  public configStyle = ConfigStyle.full;
  public settings: BehaviorSubject<IWebConfigClassPrivate<TAGS> & WebConfig>;
  private fetchingSettings = false;
  public statistic: BehaviorSubject<StatisticDTO>;

  constructor(private networkService: NetworkService,
              private jobsService: ScheduledJobsService,
              private cookieService: CookieService) {
    this.statistic = new BehaviorSubject(null);
    this.settings = new BehaviorSubject<IWebConfigClassPrivate<TAGS> & WebConfig>(WebConfigClassBuilder.attachPrivateInterface(new WebConfig()));
    this.getSettings().catch(console.error);

    if (this.cookieService.check(CookieNames.configPriority)) {
      this.configPriority =
          parseInt(this.cookieService.get(CookieNames.configPriority));
    }
    if (this.cookieService.check(CookieNames.configStyle)) {
      this.configStyle =
          parseInt(this.cookieService.get(CookieNames.configStyle));
    }


    this.settings.pipe(first()).subscribe(() => {
      this.loadStatistic();
    });
    this.jobsService.onJobFinish.subscribe((jobName: string) => {
      if (
          jobName === DefaultsJobs[DefaultsJobs.Indexing] ||
          jobName === DefaultsJobs[DefaultsJobs['Gallery Reset']]
      ) {
        this.loadStatistic();
      }
    });

  }

  public async getSettings(): Promise<void> {
    if (this.fetchingSettings === true) {
      return;
    }
    this.fetchingSettings = true;
    try {
      const wcg = WebConfigClassBuilder.attachPrivateInterface(new WebConfig());
      wcg.load(
          await this.networkService.getJson<Promise<WebConfig>>('/settings')
      );
      this.settings.next(wcg);
    } catch (e) {
      console.error(e);
    }
    this.fetchingSettings = false;
  }


  public updateSettings(settings: Record<string, any>, settingsPath: string): Promise<void> {
    return this.networkService.putJson('/settings', {settings, settingsPath});
  }

  configSetupChanged(): void {
    // save it for some years
    this.cookieService.set(
        CookieNames.configPriority,
        this.configPriority.toString(),
        365 * 50
    );
    // save it for some years
    this.cookieService.set(
        CookieNames.configStyle,
        this.configStyle.toString(),
        365 * 50
    );
  }

  async loadStatistic(): Promise<void> {
    this.statistic.next(
        await this.networkService.getJson<StatisticDTO>('/admin/statistic')
    );
  }
}
