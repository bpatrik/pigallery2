import { Component, forwardRef, OnChanges, TemplateRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, type ValidationErrors, Validator, FormsModule } from '@angular/forms';
import {Utils} from '../../../../../../common/Utils';
import {propertyTypes} from 'typeconfig/common';
import {SearchQueryParserService} from '../../../gallery/search/search-query-parser.service';
import {
  MapLayers,
  MapPathGroupConfig,
  MapPathGroupThemeConfig,
  NavigationLinkConfig,
  NavigationLinkTypes,
  PathThemeConfig,
  SVGIconConfig,
  ThemeConfig
} from '../../../../../../common/config/public/ClientConfig';
import {ConfigStyle, SettingsService} from '../../settings.service';
import {DirectorySearchConfig, JobScheduleConfig, UserConfig} from '../../../../../../common/config/private/PrivateConfig';
import {enumToTranslatedArray} from '../../../EnumTranslations';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {CustomSettingsEntries} from '../CustomSettingsEntries';
import {GroupByTypes, SortByTypes} from '../../../../../../common/entities/SortingMethods';
import { ServerExtensionsEntryConfig } from '../../../../../../common/config/private/subconfigs/ServerExtensionsConfig';

import { GallerySearchFieldComponent } from '../../../gallery/search/search-field/search-field.gallery.component';
import { NgIconComponent } from '@ng-icons/core';
import { SortingMethodSettingsEntryComponent } from './sorting-method/sorting-method.settings-entry.component';
import { WorkflowComponent } from '../../workflow/workflow.component';
import { PopoverDirective } from 'ngx-bootstrap/popover';
import { SafeHtmlPipe } from '../../../../pipes/SafeHTMLPipe';
import {DirectorySearchListSettingsComponent} from '../../directory-search-list/directory-search-list.settings.component';
import {RecursiveState, Stateful, StatefulConfig} from '../RecursiveState';
import {DirectorySearch, SearchQueryDTO} from '../../../../../../common/entities/SearchQueryDTO';

interface OptionView {
  key: number | string;
  value: string | number;
}

@Component({
    selector: 'app-settings-entry',
    templateUrl: './settings-entry.component.html',
    styleUrl: './settings-entry.settings.component.css',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SettingsEntryComponent),
            multi: true,
        },
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => SettingsEntryComponent),
            multi: true,
        },
    ],
    imports: [
    GallerySearchFieldComponent,
    FormsModule,
    NgIconComponent,
    SortingMethodSettingsEntryComponent,
    WorkflowComponent,
    PopoverDirective,
    SafeHtmlPipe,
    DirectorySearchListSettingsComponent
]
})
export class SettingsEntryComponent
    implements ControlValueAccessor, Validator, OnChanges {
  private searchQueryParserService = inject(SearchQueryParserService);
  settingsService = inject(SettingsService);
  private modalService = inject(BsModalService);

  name: string | undefined;
  required: boolean;
  dockerWarning: boolean | undefined;
  experimental: boolean | undefined;
  placeholder: string;
  allowSpaces = false;
  description: string | undefined;
  // set by writeValue (ngModel), not by an input, so it is a signal to refresh the view
  readonly state = signal<RecursiveState | null>(null);
  // the state for the code that only runs once writeValue has set it (the template renders under @if (state()))
  private get st(): RecursiveState {
    return this.state()!;
  }
  isNumberArray = false;
  isNumber = false;
  HTMLInputType = 'text';
  title: string;
  idName: string;
  private readonly GUID = Utils.GUID();
  NavigationLinkTypes = NavigationLinkTypes;
  readonly newDirectorySearch = (): DirectorySearch => new (this.st.arrayType as new () => DirectorySearch)();
  public type: string | object | undefined;
  public arrayType: string | propertyTypes | null | undefined;
  public uiType: string | propertyTypes | null | undefined;
  // options of the select(s), static per state type, set in ngOnChanges
  optionsView: OptionView[] = [];
  navigationLinkTypeOptions: OptionView[] = [];
  userRoleOptions: OptionView[] = [];
  newThemeModalRef: BsModalRef | null;
  iconModal: {
    ref?: BsModalRef,
    error?: string
  } | undefined;
  readonly noChangeDetection = input(false);
  public readonly ConfigStyle = ConfigStyle;
  protected readonly SortByTypes = SortByTypes;
  protected readonly GroupByTypes = GroupByTypes;

  // typed views of the value for the editors of the template (it depends on uiType)
  get ArrayValue(): unknown[] {
    return this.st.value as unknown[];
  }

  get IconValue(): Stateful<SVGIconConfig> {
    return this.st.value as Stateful<SVGIconConfig>;
  }

  get MapLayersValue(): MapLayers[] {
    return this.st.value as MapLayers[];
  }

  get PathThemeGroupsValue(): (Stateful<MapPathGroupThemeConfig> & { theme: Stateful<PathThemeConfig> })[] {
    return this.st.value as (Stateful<MapPathGroupThemeConfig> & { theme: Stateful<PathThemeConfig> })[];
  }

  get PathGroupsValue(): Stateful<MapPathGroupConfig>[] {
    return this.st.value as Stateful<MapPathGroupConfig>[];
  }

  get NavigationLinksValue(): NavigationLinkConfig[] {
    return this.st.value as NavigationLinkConfig[];
  }

  get UsersValue(): UserConfig[] {
    return this.st.value as UserConfig[];
  }

  get DirectorySearchesValue(): DirectorySearchConfig[] {
    return this.st.value as DirectorySearchConfig[];
  }

  get changed(): boolean {
    if (this.Disabled || this.noChangeDetection()) {
      return false;
    }

    if (this.st.isConfigArrayType) {
      const items = this.st.value as StatefulConfig[] | undefined;
      const defaults = this.st.default as Record<string, unknown>[];
      for (let i = 0; i < (items?.length ?? 0); ++i) {
        for (const k of Object.keys(items![i].__state)) {
          if (!Utils.equalsFilter(
              items![i]?.__state[k]?.value,
              defaults[i] ? defaults[i][k] : undefined,
              ['default', '__propPath', '__created', '__prototype', '__rootConfig'])) {

            return true;
          }
        }
      }
      return false;
    }
    return !Utils.equalsFilter(this.st.value, this.st.default);
  }


  get isOriginal(): boolean {
    if (this.Disabled) {
      return true;
    }
    return Utils.equalsFilter(this.st.value, this.st.original);
  }

  get shouldHide(): boolean {
    this.settingsService.edits(); // depends on other entries: refresh after every edit
    return !!this.st.shouldHide && this.st.shouldHide();
  }

  get defaultStr(): string {
    if (this.type === 'SearchQuery') {
      return (
          '\'' + this.searchQueryParserService.stringify(this.st.default as SearchQueryDTO) + '\''
      );
    }

    if (this.st.type === 'array' && this.st.arrayType === 'string') {
      return ((this.st.default as string[]) || []).join(';');
    }

    return this.st.default as string;
  }


  get StringValue(): string {
    if (
        this.st.type === 'array' &&
        (this.st.arrayType === 'string' || this.isNumberArray)
    ) {
      return ((this.st.value as unknown[]) || []).join(';');
    }

    if (this.st.isConfigType) {
      return JSON.stringify((this.st.value as StatefulConfig).toJSON());
    }

    if (typeof this.st.value === 'object') {
      return JSON.stringify(this.st.value);
    }

    return this.st.value as string;
  }

  set StringValue(value: string) {
    if (
        this.st.type === 'array' &&
        (this.st.arrayType === 'string' || this.isNumberArray)
    ) {
      value = value.replace(new RegExp(',', 'g'), ';');
      if (!this.allowSpaces) {
        value = value.replace(new RegExp(' ', 'g'), ';');
      }
      const values = value.split(';').filter((v: string) => v !== '');
      this.st.value = values;
      if (this.isNumberArray) {
        this.st.value = values
            .map((v: string) => parseFloat(v))
            .filter((v: number) => !isNaN(v));
      }
      return;
    }
    if (typeof this.st.value === 'object') {
      this.st.value = JSON.parse(value);
      return;
    }

    this.st.value = value;
    if (this.isNumber) {
      this.st.value = parseFloat(value);
    }

  }

  get AvailableThemes() {
    this.settingsService.edits(); // depends on other entries: refresh after every edit
    return [{
      key: 'default',
      value: $localize`default`
    }, ...(this.st.rootConfig!.__state['availableThemes'].value as ThemeConfig[])
        .map((th: ThemeConfig) => ({key: th.name, value: th.name}))];
  }


  get SelectedThemeSettings(): {
    theme: string | undefined
  } {
    this.settingsService.edits(); // depends on other entries: refresh after every edit
    return (this.st.value as ThemeConfig[]).find(th => th.name === this.st.rootConfig!.__state['selectedTheme'].value) || {theme: 'N/A'};
  }

  get Disabled() {
    this.settingsService.edits(); // depends on other entries: refresh after every edit
    const uiDisabled = this.state()?.tags?.uiDisabled;
    if (!uiDisabled) {
      return false;
    }
    return uiDisabled(this.st.rootConfig, this.settingsService.settings());
  }

  // Derives the editor from this.state(), which is set by writeValue, not by an input.
  ngOnChanges(): void {
    if (!this.state()) {
      return;
    }

    // cache type overrides
    this.type = this.st.tags?.uiType || this.st.type;
    this.arrayType = null;
    if (this.st.arrayType === MapLayers) {
      this.arrayType = 'MapLayers';
    } else if (this.st.arrayType === NavigationLinkConfig) {
      this.arrayType = 'NavigationLinkConfig';
    } else if (this.st.arrayType === MapPathGroupConfig) {
      this.arrayType = 'MapPathGroupConfig';
    } else if (this.st.arrayType === MapPathGroupThemeConfig) {
      this.arrayType = 'MapPathGroupThemeConfig';
    } else if (this.st.arrayType === UserConfig) {
      this.arrayType = 'UserConfig';
    } else if (this.st.arrayType === ServerExtensionsEntryConfig) {
      this.arrayType = 'ServerExtensionsEntryConfig';
    } else if (this.st.arrayType === JobScheduleConfig) {
      this.arrayType = 'JobScheduleConfig';
    } else {
      this.arrayType = this.st.arrayType;
    }

    if (this.st.tags?.uiOptions) {
      this.st.isEnumType = true;
    }
    this.uiType = this.arrayType;
    if (CustomSettingsEntries.iS(this.st)) {
      this.uiType = CustomSettingsEntries.getFullName(this.st);
    }
    if (!this.st.isEnumType &&
        !this.st.isEnumArrayType &&
        this.type !== 'boolean' &&
        this.type !== 'SearchQuery' &&
        !CustomSettingsEntries.iS(this.st) &&
        this.arrayType !== 'MapLayers' &&
        this.arrayType !== 'NavigationLinkConfig' &&
        this.arrayType !== 'MapPathGroupConfig' &&
        this.arrayType !== 'ServerExtensionsEntryConfig' &&
        this.arrayType !== 'MapPathGroupThemeConfig' &&
        this.arrayType !== 'JobScheduleConfig-Array' &&
        this.arrayType !== 'UserConfig') {
      this.uiType = 'StringInput';
    }
    if (this.type === this.st.tags?.uiType) {
      this.uiType = this.st.tags?.uiType;
    } else if (this.st.isEnumType) {
      this.uiType = 'EnumType';
    } else if (this.type === 'boolean') {
      this.uiType = 'Boolean';
    } else if (this.st.isEnumArrayType) {
      this.uiType = 'EnumArray';
    }

    this.optionsView = this.uiType === 'EnumType' || this.uiType === 'EnumArray' ?
      this.getOptionsView(this.st) : [];
    this.navigationLinkTypeOptions = this.arrayType === 'NavigationLinkConfig' ?
      this.getOptionsView(this.newArrayItemState('type')) : [];
    this.userRoleOptions = this.arrayType === 'UserConfig' ?
      this.getOptionsView(this.newArrayItemState('role')) : [];

    this.placeholder = (this.st.tags?.hint || this.st.default) as string;

    this.title = '';
    if (this.st.readonly) {
      this.title = $localize`readonly` + ', ';
    }
    this.title += $localize`default value` + ': ' + this.defaultStr;
    this.name = this.st.tags?.name;
    if (this.name) {
      this.idName =
          this.GUID + this.name.toLowerCase().replace(new RegExp(' ', 'gm'), '-');
    }
    this.isNumberArray =
        this.st.arrayType === 'unsignedInt' ||
        this.st.arrayType === 'integer' ||
        this.st.arrayType === 'float' ||
        this.st.arrayType === 'positiveFloat';
    this.isNumber =
        this.st.type === 'unsignedInt' ||
        this.st.type === 'integer' ||
        this.st.type === 'float' ||
        this.st.type === 'positiveFloat';


    if (this.isNumber) {
      this.HTMLInputType = 'number';
    } else if (this.st.type === 'password') {
      this.HTMLInputType = 'password';
    } else {
      this.HTMLInputType = 'text';
    }
    this.description = this.description || this.st.description;
    if (this.st.tags) {
      if (typeof this.dockerWarning === 'undefined') {
        this.dockerWarning = this.st.tags.dockerSensitive && this.settingsService.settings().Environment.isDocker;
      }
      this.name = this.name || this.st.tags.name;
      this.allowSpaces = this.allowSpaces || !!this.st.tags.uiAllowSpaces;
      this.required = this.required || !this.st.tags.uiOptional;
      this.experimental = this.st.tags.experimental;
    }
  }

  // The state of a property of the array items. It is the same for every item, so a fresh item is used.
  private newArrayItemState(property: string): RecursiveState {
    return new (this.st.arrayType as new () => StatefulConfig)().__state[property];
  }

  private getOptionsView(state: RecursiveState): OptionView[] {
    const eClass = state.isEnumType
        ? state.type
        : state.arrayType;
    const uiOptions = state.tags?.uiOptions;
    if (uiOptions && typeof eClass === 'object') {
      // enum with a restricted set of options
      return enumToTranslatedArray(eClass)
        .filter(o => uiOptions.includes(o.key));
    }
    if (state.tags?.uiOptions) {
      return state.tags?.uiOptions.map(o => ({
        key: o,
        value: o + (state.tags?.unit ? state.tags?.unit : '')
      }));
    }
    return enumToTranslatedArray(eClass as object);
  }

  validate(): ValidationErrors | null {
    if (
        !this.required ||
        (this.state() &&
            typeof this.st.value !== 'undefined' &&
            this.st.value !== null &&
            this.st.value !== '')
    ) {
      return null;
    }
    return {required: true};
  }

  public onChange = (_value: unknown): void => {
    // empty
  };

  public onTouched = (): void => {
    // empty
  };
  newThemeName: string;

  public writeValue(obj: RecursiveState): void {
    this.state.set(obj);
    this.ngOnChanges();
  }

  public registerOnChange(fn: (v: never) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  AddNew(): void {
    this.st.value = this.st.value || [];
    const items = this.st.value as unknown[];
    if (this.st.type === 'array') {
      if (this.st.isConfigArrayType && this.st.arrayType) {
        items.push(new (this.st.arrayType as new () => unknown)());
        return;
      }
      items.push(items[items.length - 1]);
    }
  }

  remove(i: number): void {
    (this.st.value as unknown[]).splice(i, 1);
    this.onChange(null);
  }

  /**
   * MapLayer function
   */
  addNewLayer(): void {
    const layers = this.st.value as MapLayers[];
    layers.push({
      name: 'Layer-' + layers.length,
      url: '',
    } as MapLayers);
  }

  removeLayer(layer: MapLayers): void {
    const layers = this.st.value as MapLayers[];
    layers.splice(
        layers.indexOf(layer),
        1
    );
  }


  addNewTheme(): void {
    const availableThemes = this.st.rootConfig!.__state['availableThemes'];
    if (!this.newThemeName ||
        (availableThemes.value as ThemeConfig[]).find(th => th.name === this.newThemeName)) {
      return;
    }
    this.st.value = this.newThemeName;
    (availableThemes.value as ThemeConfig[])
      .push(new (availableThemes.arrayType as typeof ThemeConfig)(this.newThemeName, ''));
    this.newThemeName = '';
    this.onChange(null);
    this.hideNewThemeModal();
  }


  removeTheme(): void {
    const availableThemes = this.st.rootConfig!.__state['availableThemes'];
    const i = (availableThemes.value as ThemeConfig[]).findIndex(th => th.name === this.st.value);
    if (i >= 0) {
      this.st.value = 'default';
      (availableThemes.value as ThemeConfig[]).splice(i, 1);
      this.onChange(null);
    }

  }

  showNewThemeModal(template: TemplateRef<unknown>): void {
    this.newThemeModalRef = this.modalService.show(template, {
      class: 'modal-lg',
    });
    document.body.style.paddingRight = '0px';
  }


  showIconModal(template: TemplateRef<unknown>): void {
    this.iconModal = {};
    this.iconModal.ref = this.modalService.show(template, {
      class: 'modal-lg',
    });
    document.body.style.paddingRight = '0px';
  }


  public hideNewThemeModal(): void {
    this.newThemeModalRef?.hide();
    this.newThemeModalRef = null;
  }

  hideIconModal(): void {
    if (!this.iconModal) {
      return;
    }
    this.iconModal.ref?.hide();
    this.iconModal = undefined;
  }

  newSvgFile(event: Event): void {

    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(reader.result as string, 'image/svg+xml');
      try {
        const wb = doc.documentElement.getAttribute('viewBox');
        const items = doc.documentElement.innerHTML;
        const icon = this.st.value as SVGIconConfig;
        icon.items = items;
        icon.viewBox = wb as string;
      } catch (e) {
        console.error(e);
        if (this.iconModal) {
          this.iconModal.error = 'Can\'t parse SVG file: ' + e.toState;
        }
      }
      this.onChange(null);
    };
    reader.readAsText(file);

  }

}



