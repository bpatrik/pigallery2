import {Component, OnInit, inject, viewChild, input, computed, signal, DestroyRef} from '@angular/core';
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
import {RecursiveState, StatefulConfig, subStates} from './RecursiveState';


export interface UiJobRow {
  job: UiJob;
  danger: boolean;
  relevant: boolean;
  progress: JobProgressDTO;
}

type UiJob = NonNullable<TAGS['uiJob']>[number];

@Component({
  selector: 'app-settings-template',
  templateUrl: './template.component.html',
  styleUrl: './template.component.css',
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

  readonly ConfigPath = input<string>();

  readonly form = viewChild<UntypedFormControl>('settingsForm');


  public readonly inProgress = signal(false);
  public readonly error = signal<string | null>(null);
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
  public readonly icon = computed<string | undefined>(() => this.states().tags?.uiIcon);
  // the config object of the card, its `enabled` switch is in the header
  protected readonly config = computed(() => this.states().value as StatefulConfig & { enabled?: boolean });
  protected readonly uiJob = computed(() => this.states().tags?.uiJob);
  protected readonly uiJobHasDescription = computed(() => !!this.uiJob()?.[0].description);
  public readonly nestedConfigs = computed(() => {
    const states = this.states();
    const nestedConfigs: { id: string, name: string | undefined, visible: () => boolean, icon: string }[] = [];
    for (const key of states.keys || []) {
      const st = subStates(states)[key];
      if (st.isConfigType && st.tags?.uiIcon) {
        nestedConfigs.push({
          id: this.ConfigPath() + '.' + key,
          name: st.tags.name,
          icon: st.tags.uiIcon,
          visible: () => !(st.shouldHide && st.shouldHide())
        });
      }
    }
    return nestedConfigs;
  });
  public readonly ConfigStyle = ConfigStyle;
  protected readonly name = computed<string | undefined>(() => this.states().tags?.name || this.ConfigPath());
  public readonly Name = computed<string | undefined>(() => this.changed() ? this.name() + '*' : this.name());
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
        collect(subStates(st)[k]);
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
  private readonly uiJobDefaultConfigs = computed<Map<string, Record<string, unknown> | null>>(() => {
    const configs = new Map<string, Record<string, unknown> | null>();
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
    return !this.states().shouldHide?.();
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
      !this.authService.isAuthorized(UserRoles.Admin)
    ) {
      this.navigation.toLogin();
      return;
    }
    this.getSettings();
    // the card's jobs show their progress, also when the Jobs card (that subscribes too) is hidden
    this.jobsService.subscribeToProgress();
    this.destroyRef.onDestroy(() => this.jobsService.unsubscribeFromProgress());

    // TODO: fix after this issue is fixed: https://github.com/angular/angular/issues/24818
    this.form()?.valueChanges?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.onOptionChange();
    });
  }

  // Adds the UI helpers (shouldHide, onChange, original value, ...) to every state of the tree.
  private instrument(st: RecursiveState, parent: RecursiveState | null): void {
    const shouldHide = (state: RecursiveState) => {
      return () => {
        if (state.volatile) {
          return true;
        }

        if (state.tags &&
          ((state.tags.relevant && !state.tags.relevant(parent?.value))
            || state.tags.secret)) {
          return true;
        }

        // if all sub elements are hidden, hide the parent too.
        if (state.isConfigType) {
          if (state.value && subStates(state) &&
            Object.keys(subStates(state)).findIndex(k => !subStates(st)[k].shouldHide?.()) === -1) {
            return true;
          }
        }

        const priority = state.tags?.priority;
        const forcedVisibility = !((priority !== undefined && priority > this.settingsService.configPriority()) ||
          //if this value should not change in Docker, lets hide it
          (this.settingsService.configPriority() === ConfigPriority.basic &&
            state.tags?.dockerSensitive && this.settingsService.settings().Environment.isDocker));

        if (state.isConfigArrayType) {
          const items = state.value as StatefulConfig[] | undefined;
          const defaults = state.default as Record<string, unknown>[];
          for (let i = 0; i < (items?.length ?? 0); ++i) {
            for (const k of Object.keys(items![i].__state)) {
              if (!Utils.equalsFilter(
                items![i]?.__state[k]?.value,
                defaults[i] ? defaults[i][k] : undefined,
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
    st.rootConfig = parent?.value as StatefulConfig | undefined;
    if (typeof st.value !== 'undefined') {
      st.original = Utils.clone(st.value);
    }
    const isCustom = CustomSettingsEntries.iS(st);
    st.isExpandableConfig = !!st.isConfigType && !isCustom;
    st.isExpandableArrayConfig = !!st.isConfigArrayType && !isCustom;
    st.isExtension = !!(st.isConfigType && st.value) && this.isExtension(st);

    if (st.isConfigType && st.value) {
      for (const k of Object.keys(subStates(st))) {
        this.instrument(subStates(st)[k], st);
      }
    }
    if (st.isConfigArrayType && st.value) {
      for (const item of st.value as StatefulConfig[]) {
        for (const k of Object.keys(item.__state)) {
          this.instrument(item.__state[k], st);
        }
      }
    }
    // after the children, as sorting reads their flags
    st.keys = st.isConfigType && st.value ? this.sortKeys(subStates(st)) : [];
    // A snapshot of the items: edits inside them show up, but adding or removing items does not until
    // the settings are reloaded. No UI does that for these arrays (the editable ones have custom entries).
    if (st.isExpandableArrayConfig && st.value) {
      st.arrayEntries = (st.value as StatefulConfig[])
        .map(v => ({value: v, keys: this.sortKeys(v.__state)}));
    }
  }

  onOptionChange = () => {
    this.settingsService.edits.update(e => e + 1);
    setTimeout(() => {
      // walks every property, until it finds the states (they have an original value)
      const settingsSame = (s: unknown): boolean => {
        if (typeof s === 'undefined') {
          return true;
        }
        const state = s as Record<string, unknown> & Partial<RecursiveState>;
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
        this.error.set((err as ErrorDTO).message ?? null);
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
        // NaN when only one of them has a priority, sort() treats that as equal
        return (s[a].tags?.priority ?? NaN) - (s[b].tags?.priority ?? NaN);
      }

      if (a === 'enabled' && b !== 'enabled') {
        return -1;
      } else if (b === 'enabled') {
        return 1;
      }
      return (s[a].tags?.name || a).localeCompare(s[b].tags?.name || b);
    });
  }

  private isExtension(c: RecursiveState): boolean {
    const propPath = (c?.value as StatefulConfig | undefined)?.__propPath;
    if (typeof propPath !== 'string') {
      return false;
    }
    return propPath.substring(0, propPath.lastIndexOf('.')) == 'Extensions.extensions';
  }

  protected async removeExtension(c: RecursiveState): Promise<void> {
    const extensionPath = subStates(c)['path'].value as string;
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


  protected async reloadExtension(c: RecursiveState): Promise<void> {
    const extensionPath = subStates(c)['path'].value as string;
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
