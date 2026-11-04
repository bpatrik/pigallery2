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
  // UI helpers precomputed by TemplateComponent.instrument()
  keys?: any; // sorted keys of the sub configs
  arrayEntries?: any; // {value, keys} per array item of an expandable config array
  isExpandableConfig?: any;
  isExpandableArrayConfig?: any;
  isExtension?: any;

  [key: string]: RecursiveState;
}

export interface UiJobRow {
  job: UiJob;
  danger: boolean;
  relevant: boolean;
  progress: JobProgressDTO;
}

type UiJob = TAGS['uiJob'][number];

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
    for (const key of states.keys) {
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
  public readonly Name = computed<string>(() => this.changed() ? this.name() + '*' : this.name());
  /**
   * All uiJob lists of the states tree, they only change when the states are re-derived.
   */
  private readonly uiJobLists = computed<UiJob[][]>(() => {
    const lists: UiJob[][] = [];
    const collect = (st: RecursiveState): void => {
      if (st.tags?.uiJob) {
        lists.push(st.tags.uiJob);
      }
      for (const k of st.keys || []) {
        collect(st.value.__state[k]);
      }
      for (const e of st.arrayEntries || []) {
        for (const k of e.keys) {
          collect(e.value.__state[k]);
        }
      }
    };
    collect(this.states());
    return lists;
  });
  /**
   * The default config of each uiJob, it changes only when the available jobs are (re)loaded.
   */
  private readonly uiJobDefaultConfigs = computed<Map<string, Record<string, unknown>>>(() => {
    const configs = new Map<string, Record<string, unknown>>();
    for (const list of this.uiJobLists()) {
      for (const job of list) {
        configs.set(job.job, this.jobsService.getDefaultConfig(job.job));
      }
    }
    return configs;
  });
  /**
   * The job buttons and progress rows of each uiJob list (keyed by the list).
   */
  public readonly uiJobRows = computed<Map<UiJob[], UiJobRow[]>>(() => {
    const settings = this.settingsService.settings();
    const progress = this.jobsService.progress();
    const configs = this.uiJobDefaultConfigs();
    const rows = new Map<UiJob[], UiJobRow[]>();
    for (const list of this.uiJobLists()) {
      rows.set(list, list.map(job => {
        const config = configs.get(job.job);
        return {
          job,
          danger: job.job.includes('Reset') || job.job.includes('Delete'),
          relevant: !job.relevant || job.relevant(settings),
          progress: progress[JobDTOUtils.getHashName(job.job, config || {})]
        };
      }));
    }
    return rows;
  });

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
    const isCustom = CustomSettingsEntries.iS(st);
    st.isExpandableConfig = !!st.isConfigType && !isCustom;
    st.isExpandableArrayConfig = !!st.isConfigArrayType && !isCustom;
    st.isExtension = !!(st.isConfigType && st.value) && this.isExtension(st);

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
    // after the children, as sorting reads their flags
    st.keys = st.isConfigType && st.value ? this.sortKeys(st.value.__state) : [];
    // A snapshot of the items: edits inside them show up, but adding or removing items does not until
    // the settings are reloaded. No UI does that for these arrays (the editable ones have custom entries).
    if (st.isExpandableArrayConfig && st.value) {
      st.arrayEntries = (st.value as { __state: Record<string, RecursiveState> }[])
        .map(v => ({value: v, keys: this.sortKeys(v.__state)}));
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

  public async save(): Promise<boolean> {
    this.inProgress.set(true);
    this.error.set('');
    try {
      const state = WebConfigClassBuilder.attachInterface(this.states().value).toJSON();
      await this.settingsService.updateSettings(state, this.ConfigPath());
      await this.getSettings();
      this.notification.success(
        this.Name() + ' ' + $localize`settings saved`,
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

  // Expandable sub configs and arrays go last, the rest by priority and name.
  private sortKeys(s: Record<string, RecursiveState>): string[] {
    return Object.keys(s).sort((a, b) => {
      if ((s[a].isExpandableConfig || s[a].isConfigArrayType) !== (s[b].isExpandableConfig || s[b].isConfigArrayType)) {
        if (s[a].isExpandableConfig || s[a].isConfigArrayType) {
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
  }

  private isExtension(c: ConfigState): boolean {
    const propPath = (c?.value as unknown as { __propPath?: string })?.__propPath;
    if (typeof propPath !== 'string') {
      return false;
    }
    return propPath.substring(0, propPath.lastIndexOf('.')) == 'Extensions.extensions';
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
