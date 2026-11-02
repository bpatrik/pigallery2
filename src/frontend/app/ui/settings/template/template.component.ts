import {Component, OnInit, inject, viewChild, input, ChangeDetectionStrategy, computed, signal, DestroyRef} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {NavigationService} from '../../../model/navigation.service';
import {NotificationService} from '../../../model/notification.service';
import {ConfigStyle, SettingsService} from '../settings.service';
import {WebConfig} from '../../../../../common/config/private/WebConfig';
import {JobProgressDTO} from '../../../../../common/entities/job/JobProgressDTO';
import {JobDTOUtils} from '../../../../../common/entities/job/JobDTO';
import {ScheduledJobsService} from '../scheduled-jobs.service';
import {FormsModule, UntypedFormControl} from '@angular/forms';
import {IWebConfigClassPrivate} from 'typeconfig/common';
import {ConfigPriority, TAGS} from '../../../../../common/config/public/ClientConfig';
import {Utils} from '../../../../../common/Utils';
import {UserRoles} from '../../../../../common/entities/UserDTO';
import {WebConfigClassBuilder} from 'typeconfig/web';
import {ErrorDTO} from '../../../../../common/entities/Error';
import {ISettingsComponent} from './ISettingsComponent';
import {CustomSettingsEntries} from './CustomSettingsEntries';
import {NgIconComponent} from '@ng-icons/core';
import {NgTemplateOutlet} from '@angular/common';
import {SettingsEntryComponent} from './settings-entry/settings-entry.component';
import {JobButtonComponent} from '../workflow/button/job-button.settings.component';
import {JobProgressComponent} from '../workflow/progress/job-progress.settings.component';
import {ExtensionInstallerService} from '../extension-installer/extension-installer.service';


interface ConfigState {
  value: {
    [key: string]: RecursiveState;
  };
  default: {
    [key: string]: RecursiveState;
  };
  readonly?: boolean;
  tags?: TAGS;
  volatile?: boolean;
  isEnumType?: boolean;
  isConfigType?: boolean;
  isConfigArrayType?: boolean;
}

export interface RecursiveState extends ConfigState {
  value: any;
  default: any;
  volatile?: any;
  tags?: any;
  isConfigType?: any;
  isConfigArrayType?: any;
  isEnumType?: any;
  readonly?: any;
  toJSON?: any;
  onChange?: any;
  original?: any;
  shouldHide?: any;

  [key: string]: RecursiveState;
}

@Component({
  selector: 'app-settings-template',
  templateUrl: './template.component.html',
  styleUrl: './template.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, NgIconComponent, NgTemplateOutlet, SettingsEntryComponent, JobButtonComponent, JobProgressComponent]
})
export class TemplateComponent implements OnInit, ISettingsComponent {
  protected authService = inject(AuthenticationService);
  private navigation = inject(NavigationService);
  protected notification = inject(NotificationService);
  settingsService = inject(SettingsService);
  jobsService = inject(ScheduledJobsService);
  private extensionService = inject(ExtensionInstallerService);


  private destroyRef = inject(DestroyRef);

  readonly ConfigPath = input<string>(undefined);

  readonly form = viewChild<UntypedFormControl>('settingsForm');


  public readonly inProgress = signal(false);
  public readonly error = signal<string>(null);
  public readonly changed = signal(false);
  /**
   * A fresh, instrumented clone of the current settings slice.
   * The UI edits it in place; it is only re-derived when the settings are (re)loaded.
   */
  public readonly states = computed<RecursiveState>(() => {
    const s = this.settingsService.settings().clone() as IWebConfigClassPrivate<TAGS> & WebConfig;
    const configPath = this.ConfigPath();
    const states = (!configPath ?
      {value: s, isConfigType: true, type: WebConfig} :
      s.__state[configPath]) as unknown as RecursiveState;
    this.instrument(states, null);
    return states;
  });
  public readonly icon = computed<string>(() => this.states().tags?.uiIcon);
  public readonly nestedConfigs = computed(() => {
    const states = this.states();
    const nestedConfigs: { id: string, name: string, visible: () => boolean, icon: string }[] = [];
    for (const key of this.getKeys(states)) {
      const st = states.value.__state[key];
      if (st.isConfigType && st.tags?.uiIcon) {
        nestedConfigs.push({
          id: this.ConfigPath() + '.' + key,
          name: st.tags?.name,
          icon: st.tags?.uiIcon,
          visible: () => !(st.shouldHide && st.shouldHide())
        });
      }
    }
    return nestedConfigs;
  });
  public readonly ConfigStyle = ConfigStyle;
  protected readonly name = computed<string>(() => this.states().tags?.name || this.ConfigPath());

  get Name(): string {
    return this.changed() ? this.name() + '*' : this.name();
  }

  get Changed(): boolean {
    return this.changed();
  }

  get HasAvailableSettings(): boolean {
    return !this.states()?.shouldHide || !this.states()?.shouldHide();
  }

  getSaveTitle(isFormInvalid: boolean): string {
    if (isFormInvalid) {
      return $localize`Can't save: invalid form.`;
    }
    if (!this.changed()) {
      return $localize`Can't save: not changed.`;
    }
    if (this.inProgress()) {
      return $localize`Can't save: saving in progress.`;
    }
    return $localize`Click to save.`;
  }

  ngOnInit(): void {

    if (
      !this.authService.isAuthenticated() ||
      this.authService.user().role < UserRoles.Admin
    ) {
      this.navigation.toLogin();
      return;
    }
    this.getSettings();

    // TODO: fix after this issue is fixed: https://github.com/angular/angular/issues/24818
    this.form().valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.onOptionChange();
    });
  }

  // Adds the UI helpers (shouldHide, onChange, original value, ...) to every state of the tree.
  private instrument(st: RecursiveState, parent: RecursiveState): void {
    const shouldHide = (state: RecursiveState) => {
      return () => {
        if (state.volatile) {
          return true;
        }

        if (state.tags &&
          ((state.tags.relevant && !state.tags.relevant(parent.value))
            || state.tags.secret)) {
          return true;
        }

        // if all sub elements are hidden, hide the parent too.
        if (state.isConfigType) {
          if (state.value && state.value.__state &&
            Object.keys(state.value.__state).findIndex(k => !st.value.__state[k].shouldHide()) === -1) {
            return true;
          }
        }

        const forcedVisibility = !(state.tags?.priority > this.settingsService.configPriority() ||
          //if this value should not change in Docker, lets hide it
          (this.settingsService.configPriority() === ConfigPriority.basic &&
            state.tags?.dockerSensitive && this.settingsService.settings().Environment.isDocker));

        if (state.isConfigArrayType) {
          for (let i = 0; i < state.value?.length; ++i) {
            for (const k of Object.keys(state.value[i].__state)) {
              if (!Utils.equalsFilter(
                state.value[i]?.__state[k]?.value,
                state.default[i] ? state.default[i][k] : undefined,
                ['default', '__propPath', '__created', '__prototype', '__rootConfig'])) {

                return false;
              }
            }
          }
          return !forcedVisibility;
        }


        return (!forcedVisibility &&
          Utils.equalsFilter(state.value, state.default,
            ['__propPath', '__created', '__prototype', '__rootConfig']) &&
          Utils.equalsFilter(state.original, state.default,
            ['__propPath', '__created', '__prototype', '__rootConfig']));
      };
    };

    st.shouldHide = shouldHide(st);
    st.onChange = this.onOptionChange;
    st.rootConfig = parent?.value;
    if (typeof st.value !== 'undefined') {
      st.original = Utils.clone(st.value);
    }

    if (st.isConfigType && st.value) {
      for (const k of Object.keys(st.value.__state)) {
        this.instrument(st.value.__state[k], st);
      }
    }
    if (st.isConfigArrayType && st.value) {
      for (let i = 0; i < st.value?.length; ++i) {
        for (const k of Object.keys(st.value[i].__state)) {
          this.instrument(st.value[i].__state[k], st);
        }
      }
    }
  }

  onOptionChange = () => {
    setTimeout(() => {
      const settingsSame = (state: RecursiveState): boolean => {
        if (typeof state === 'undefined') {
          return true;
        }
        if (typeof state.original === 'object') {
          return Utils.equalsFilter(state.value, state.original,
            ['__propPath', '__created', '__prototype', '__rootConfig', '__state']);
        }
        if (typeof state.original !== 'undefined') {
          return state.value === state.original;
        }

        const keys = Object.keys(state);

        for (const key of keys) {
          if (settingsSame(state[key]) === false) {
            return false;
          }
        }

        return true;
      };

      this.changed.set(!settingsSame(this.states()));
    }, 0);
  };

  public reset(): void {
    this.getSettings();
  }

  /**
   * main template should list it
   * @param c
   */
  isExpandableConfig(c: ConfigState) {
    return c.isConfigType && !CustomSettingsEntries.iS(c);
  }

  isExpandableArrayConfig(c: ConfigState) {
    return c.isConfigArrayType && !CustomSettingsEntries.iS(c);
  }

  public async save(): Promise<boolean> {
    this.inProgress.set(true);
    this.error.set('');
    try {
      const state = WebConfigClassBuilder.attachInterface(this.states().value).toJSON();
      await this.settingsService.updateSettings(state, this.ConfigPath());
      await this.getSettings();
      this.notification.success(
        this.Name + ' ' + $localize`settings saved`,
        $localize`Success`
      );
      this.inProgress.set(false);
      return true;
    } catch (err) {
      console.error(err);
      if (err.message) {
        this.error.set((err as ErrorDTO).message);
      }
    }

    this.inProgress.set(false);
    return false;
  }

  getKeys(states: any): string[] {
    if (states.keys) {
      return states.keys;
    }
    if (!states.value) {
      return [];
    }
    const s = states.value.__state;
    const keys = Object.keys(s).sort((a, b) => {
      if ((this.isExpandableConfig(s[a]) || s[a].isConfigArrayType) !== (this.isExpandableConfig(s[b]) || s[b].isConfigArrayType)) {
        if (this.isExpandableConfig(s[a]) || s[a].isConfigArrayType) {
          return 1;
        } else {
          return -1;
        }
      }
      if (s[a].tags?.priority !== s[b].tags?.priority) {
        return s[a].tags?.priority - s[b].tags?.priority;
      }

      if (a === 'enabled' && b !== 'enabled') {
        return -1;
      } else if (b === 'enabled') {
        return 1;
      }
      return (s[a].tags?.name as string || a).localeCompare(s[b].tags?.name || b);
    });
    states.keys = keys;
    return states.keys;
  }

  getProgress(uiJob: { job: string, config?: any }): JobProgressDTO {
    if (!uiJob.config) {
      uiJob.config = this.jobsService.getDefaultConfig(uiJob.job);
    }
    return this.jobsService.progress()[JobDTOUtils.getHashName(uiJob.job, uiJob.config || {})];
  }

  protected isExtension(c: ConfigState): boolean {
    return (c?.value?.__propPath as any).substring(0, (c?.value?.__propPath as any).lastIndexOf('.')) == 'Extensions.extensions';
  }

  protected async removeExtension(c: ConfigState): Promise<void> {
    const extensionPath = c.value.__state['path'].value;
    try {
      this.inProgress.set(true);
      await this.extensionService.deleteExtension(extensionPath);
      await this.settingsService.getSettings();
      this.notification.success(
        $localize`Extension deleted successfully`,
        $localize`Success`
      );
    } catch (err) {
      console.error(err);
      this.notification.error($localize`Failed to delete extension`, err);
    } finally {
      this.inProgress.set(false);
    }
  }


  protected async reloadExtension(c: ConfigState): Promise<void> {
    const extensionPath = c.value.__state['path'].value;
    try {
      this.inProgress.set(true);
      await this.extensionService.reloadExtension(extensionPath);
      await this.settingsService.getSettings();
      this.notification.success(
        $localize`Extension reloaded successfully`,
        $localize`Success`
      );
    } catch (err) {
      console.error(err);
      this.notification.error($localize`Failed to reload extension`, err);
    } finally {
      this.inProgress.set(false);
    }
  }

  private async getSettings(): Promise<void> {
    await this.settingsService.getSettings();
    this.changed.set(false);
  }
}
