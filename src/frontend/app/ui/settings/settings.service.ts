import {Injectable, inject, signal} from '@angular/core';
import {NetworkService} from '../../model/network/network.service';

import {WebConfig} from '../../../../common/config/private/WebConfig';
import {WebConfigClassBuilder} from 'typeconfig/web';
import {ConfigPriority, TAGS} from '../../../../common/config/public/ClientConfig';
import {CookieNames} from '../../../../common/CookieNames';
import {CookieHelper} from '../../model/cookie.helper';
import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import {StatisticDTO} from '../../../../common/entities/settings/StatisticDTO';
import {ScheduledJobsService} from './scheduled-jobs.service';
import {IWebConfigClassPrivate} from 'typeconfig/common';


export enum ConfigStyle {
  full = 1, compact
}


@Injectable({providedIn: 'root'})
export class SettingsService {
  private networkService = inject(NetworkService);
  private jobsService = inject(ScheduledJobsService);

  public readonly configPriority = signal<ConfigPriority>(ConfigPriority.basic);
  public readonly configStyle = signal<ConfigStyle>(ConfigStyle.full);
  public readonly settings = signal<IWebConfigClassPrivate<TAGS> & WebConfig>(WebConfigClassBuilder.attachPrivateInterface(new WebConfig()));
  private fetchingSettings = false;
  public readonly statistic = signal<StatisticDTO | null>(null);
  // Bumped on every edit of the settings forms. The forms edit the settings states in place, so the views
  // that read another entry's value (hiding, disabling, theme lists) read this to refresh.
  public readonly edits = signal(0);

  constructor() {
    this.getSettings().catch(console.error);

    const configPriority = CookieHelper.get(CookieNames.configPriority);
    if (configPriority != null) {
      this.configPriority.set(parseInt(configPriority));
    }
    const configStyle = CookieHelper.get(CookieNames.configStyle);
    if (configStyle != null) {
      this.configStyle.set(parseInt(configStyle));
    }

    this.loadStatistic().catch(console.error);
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
      const wcg: IWebConfigClassPrivate<TAGS> & WebConfig = WebConfigClassBuilder.attachPrivateInterface(new WebConfig());
      wcg.load(
          await this.networkService.getJson<Promise<WebConfig>>('/settings')
      );
      this.settings.set(wcg);
    } catch (e) {
      console.error(e);
    }
    this.fetchingSettings = false;
  }


  public updateSettings(settings: Record<string, unknown>, settingsPath: string | undefined): Promise<void> {
    return this.networkService.putJson('/settings', {settings, settingsPath});
  }

  configSetupChanged(): void {
    // save it for some years
    CookieHelper.set(
        CookieNames.configPriority,
        this.configPriority().toString(),
        365 * 50
    );
    // save it for some years
    CookieHelper.set(
        CookieNames.configStyle,
        this.configStyle().toString(),
        365 * 50
    );
  }

  async loadStatistic(): Promise<void> {
    this.statistic.set(
        await this.networkService.getJson<StatisticDTO>('/admin/statistic')
    );
  }
}
