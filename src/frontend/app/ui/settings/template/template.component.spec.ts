import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {WebConfigClassBuilder} from 'typeconfig/web';
import {IWebConfigClassPrivate} from 'typeconfig/common';
import {TemplateComponent} from './template.component';
import {SettingsService} from '../settings.service';
import {ScheduledJobsService} from '../scheduled-jobs.service';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {NavigationService} from '../../../model/navigation.service';
import {NotificationService} from '../../../model/notification.service';
import {ExtensionInstallerService} from '../extension-installer/extension-installer.service';
import {WebConfig} from '../../../../../common/config/private/WebConfig';
import {ConfigPriority, TAGS} from '../../../../../common/config/public/ClientConfig';

describe('TemplateComponent', () => {
  type Settings = IWebConfigClassPrivate<TAGS> & WebConfig;

  const createSettings = (authenticationRequired: boolean): Settings => {
    const wc = WebConfigClassBuilder.attachPrivateInterface(new WebConfig());
    wc.load({Users: {authenticationRequired}} as unknown as WebConfig);
    return wc;
  };

  const setUp = (configPath: string) => {
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
        {provide: ScheduledJobsService, useValue: {progress: signal({}), getDefaultConfig: vi.fn()}},
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

    expect(states.value.authenticationRequired).toBe(true);
    expect(states.value).not.toBe(settingsService.settings().Users);
    // cached while the settings do not change, so in-place UI edits stay
    states.value.authenticationRequired = false;
    expect(component.states()).toBe(states);
    expect(settingsService.settings().Users.authenticationRequired).toBe(true);
  });

  it('should re-derive the states when the settings are reloaded', () => {
    const {component, settingsService} = setUp('Users');
    const oldStates = component.states();
    oldStates.value.authenticationRequired = true;

    settingsService.settings.set(createSettings(false));

    const newStates = component.states();
    expect(newStates).not.toBe(oldStates);
    expect(newStates.value.authenticationRequired).toBe(false);
    // the old (dropped) states are not touched anymore
    expect(oldStates.value.authenticationRequired).toBe(true);
  });

  it('should derive the name, icon and nested configs from the config path', () => {
    const {component, fixture} = setUp('Users');
    expect(component.Name).toBe('Users');
    expect(component.icon()).toBe('ionPersonOutline');
    expect(component.nestedConfigs().map(n => n.id)).toEqual(['Users.oidc']);

    fixture.componentRef.setInput('ConfigPath', 'Database');
    expect(component.states().value.__state.dbFolder).toBeDefined();
    expect(component.Name).toBe('Database');
    expect(component.icon()).toBe('ionServerOutline');
  });
});
