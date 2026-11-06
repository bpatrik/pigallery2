import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {WebConfigClassBuilder} from 'typeconfig/web';
import {IWebConfigClassPrivate} from 'typeconfig/common';
import {TemplateComponent} from './template.component';
import {RecursiveState, subStates} from './RecursiveState';
import {SettingsService} from '../settings.service';
import {ScheduledJobsService} from '../scheduled-jobs.service';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {NavigationService} from '../../../model/navigation.service';
import {NotificationService} from '../../../model/notification.service';
import {ExtensionInstallerService} from '../extension-installer/extension-installer.service';
import {WebConfig} from '../../../../../common/config/private/WebConfig';
import {ConfigPriority, TAGS} from '../../../../../common/config/public/ClientConfig';
import {JobDTOUtils} from '../../../../../common/entities/job/JobDTO';
import {JobProgressDTO} from '../../../../../common/entities/job/JobProgressDTO';

describe('TemplateComponent', () => {
  type Settings = IWebConfigClassPrivate<TAGS> & WebConfig;
  // the Users config of the states
  const users = (st: RecursiveState): { authenticationRequired: boolean } => st.value as { authenticationRequired: boolean };

  const createSettings = (authenticationRequired: boolean): Settings => {
    const wc: Settings = WebConfigClassBuilder.attachPrivateInterface(new WebConfig());
    wc.load({Users: {authenticationRequired}} as unknown as WebConfig);
    return wc;
  };

  const setUp = (configPath: string, jobsService: Record<string, unknown> = {progress: signal({}), getDefaultConfig: vi.fn()}) => {
    const settingsService = {
      settings: signal<Settings>(createSettings(true)),
      configPriority: signal(ConfigPriority.underTheHood),
      configStyle: signal(1),
      getSettings: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [TemplateComponent],
      providers: [
        {provide: SettingsService, useValue: settingsService},
        {provide: ScheduledJobsService, useValue: jobsService},
        {provide: AuthenticationService, useValue: {isAuthenticated: () => false}},
        {provide: NavigationService, useValue: {toLogin: vi.fn()}},
        {provide: NotificationService, useValue: {}},
        {provide: ExtensionInstallerService, useValue: {}},
      ]
    });
    // only the derived state is tested here, not the settings UI
    TestBed.overrideComponent(TemplateComponent, {set: {template: '', imports: []}});
    const fixture = TestBed.createComponent(TemplateComponent);
    fixture.componentRef.setInput('ConfigPath', configPath);
    return {component: fixture.componentInstance, fixture, settingsService};
  };

  it('should derive the states from a clone of the current settings', () => {
    const {component, settingsService} = setUp('Users');
    const states = component.states();

    expect(users(states).authenticationRequired).toBe(true);
    expect(states.value).not.toBe(settingsService.settings().Users);
    // cached while the settings do not change, so in-place UI edits stay
    users(states).authenticationRequired = false;
    expect(component.states()).toBe(states);
    expect(settingsService.settings().Users.authenticationRequired).toBe(true);
  });

  it('should re-derive the states when the settings are reloaded', () => {
    const {component, settingsService} = setUp('Users');
    const oldStates = component.states();
    users(oldStates).authenticationRequired = true;

    settingsService.settings.set(createSettings(false));

    const newStates = component.states();
    expect(newStates).not.toBe(oldStates);
    expect(users(newStates).authenticationRequired).toBe(false);
    // the old (dropped) states are not touched anymore
    expect(users(oldStates).authenticationRequired).toBe(true);
  });

  it('should derive the name, icon and nested configs from the config path', () => {
    const {component, fixture} = setUp('Users');
    expect(component.Name()).toBe('Users');
    expect(component.icon()).toBe('ionPersonOutline');
    expect(component.nestedConfigs().map(n => n.id)).toEqual(['Users.oidc']);

    fixture.componentRef.setInput('ConfigPath', 'Database');
    expect(subStates(component.states())['dbFolder']).toBeDefined();
    expect(component.Name()).toBe('Database');
    expect(component.icon()).toBe('ionServerOutline');
  });

  it('should mark the name as changed', () => {
    const {component} = setUp('Users');
    component.changed.set(true);
    expect(component.Name()).toBe('Users*');
  });

  it('should precompute the sorted keys and the expandable flags of the states', () => {
    const {component} = setUp('Users');
    const states = component.states();
    // the sub config and the array go last
    expect(states.keys!.slice(-2).sort()).toEqual(['enforcedUsers', 'oidc']);
    expect(states.keys).toContain('authenticationRequired');
    expect(subStates(states)['oidc'].isExpandableConfig).toBe(true);
    expect(subStates(states)['oidc'].keys!.length).toBeGreaterThan(0);
    expect(subStates(states)['authenticationRequired'].isExpandableConfig).toBe(false);
    // users have a custom UI
    expect(subStates(states)['enforcedUsers'].isExpandableArrayConfig).toBe(false);
    expect(subStates(states)['oidc'].isExtension).toBe(false);
  });

  it('should list the ui jobs with their progress and default config', () => {
    const defaultConfig = {indexChangesOnly: true};
    const progress = {jobName: 'Indexing'} as JobProgressDTO;
    const jobsService = {
      progress: signal({[JobDTOUtils.getHashName('Indexing', defaultConfig)]: progress}),
      getDefaultConfig: vi.fn((job: string) => job === 'Indexing' ? defaultConfig : null)
    };
    const {component} = setUp('Indexing', jobsService);
    const uiJobTag = component.states().tags?.uiJob;
    expect(uiJobTag).toBeDefined();
    const uiJob = uiJobTag!;
    const rows = component.uiJobRows().get(uiJob)!;

    expect(rows.map(r => r.job.job)).toEqual(['Indexing', 'Gallery Reset']);
    expect(rows.map(r => r.danger)).toEqual([false, true]);
    expect(rows.map(r => r.relevant)).toEqual([true, true]);
    expect(rows[0].progress).toBe(progress);
    expect(rows[1].progress).toBeUndefined();
    // the default configs are not looked up again on a progress change
    const calls = jobsService.getDefaultConfig.mock.calls.length;
    jobsService.progress.set({});
    expect(component.uiJobRows().get(uiJob)![0].progress).toBeUndefined();
    expect(jobsService.getDefaultConfig.mock.calls.length).toBe(calls);
  });
});
