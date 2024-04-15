import {Component, forwardRef, Input, OnChanges, TemplateRef} from '@angular/core';
import {ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator,} from '@angular/forms';
import {Utils} from '../../../../../../common/Utils';
import {propertyTypes} from 'typeconfig/common';
import {SearchQueryParserService} from '../../../gallery/search/search-query-parser.service';
import {
  MapLayers,
  MapPathGroupConfig,
  MapPathGroupThemeConfig,
  NavigationLinkConfig,
  NavigationLinkTypes,
  TAGS,
  ThemeConfig
} from '../../../../../../common/config/public/ClientConfig';
import {ConfigStyle, SettingsService} from '../../settings.service';
import {WebConfig} from '../../../../../../common/config/private/WebConfig';
import {JobScheduleConfig, UserConfig} from '../../../../../../common/config/private/PrivateConfig';
import {enumToTranslatedArray} from '../../../EnumTranslations';
import {BsModalService} from 'ngx-bootstrap/modal';
import {CustomSettingsEntries} from '../CustomSettingsEntries';
import {GroupByTypes, SortByTypes} from '../../../../../../common/entities/SortingMethods';
import { ServerExtensionsEntryConfig } from '../../../../../../common/config/private/subconfigs/ServerExtensionsConfig';

interface IState {
  shouldHide(): boolean;

  isEnumArrayType: boolean;
  isEnumType: boolean;
  isConfigType: boolean;
  isConfigArrayType: boolean;
  default: any;
  value: any;
  min?: number;
  max?: number;
  type: propertyTypes;
  arrayType: any;
  original: any;
  rootConfig: WebConfig;
  readonly?: boolean;
  description?: string;
  tags: TAGS;
}

@Component({
  selector: 'app-settings-entry',
  templateUrl: './settings-entry.component.html',
  styleUrls: ['./settings-entry.settings.component.css'],
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
})
export class SettingsEntryComponent
    implements ControlValueAccessor, Validator, OnChanges {
  name: string;
  required: boolean;
  dockerWarning: boolean;
  experimental: boolean;
  placeholder: string;
  allowSpaces = false;
  description: string;
  state: IState;
  isNumberArray = false;
  isNumber = false;
  HTMLInputType = 'text';
  title: string;
  idName: string;
  private readonly GUID = Utils.GUID();
  NavigationLinkTypes = NavigationLinkTypes;
  public type: string | object;
  public arrayType: string;
  public uiType: string;
  newThemeModalRef: any;
  iconModal: {
    ref?: any,
    error?: string
  };
  @Input() noChangeDetection = false;
  public readonly ConfigStyle = ConfigStyle;
  protected readonly SortByTypes = SortByTypes;
  protected readonly GroupByTypes = GroupByTypes;


  constructor(private searchQueryParserService: SearchQueryParserService,
              public settingsService: SettingsService,
              private modalService: BsModalService,
  ) {
  }

  get changed(): boolean {
    if (this.Disabled || this.noChangeDetection) {
      return false;
    }

    if (this.state.isConfigArrayType) {
      for (let i = 0; i < this.state.value?.length; ++i) {
        for (const k of Object.keys(this.state.value[i].__state)) {
          if (!Utils.equalsFilter(
              this.state.value[i]?.__state[k]?.value,
              this.state.default[i] ? this.state.default[i][k] : undefined,
              ['default', '__propPath', '__created', '__prototype', '__rootConfig'])) {

            return true;
          }
        }
      }
      return false;
    }
    return !Utils.equalsFilter(this.state.value, this.state.default);
  }


  get isOriginal(): boolean {
    if (this.Disabled) {
      return true;
    }
    return Utils.equalsFilter(this.state.value, this.state.original);
  }

  get shouldHide(): boolean {
    return this.state.shouldHide && this.state.shouldHide();
  }

  get defaultStr(): string {
    if (this.type === 'SearchQuery') {
      return (
          '\'' + this.searchQueryParserService.stringify(this.state.default) + '\''
      );
    }

    if (this.state.type === 'array' && this.state.arrayType === 'string') {
      return (this.state.default || []).join(';');
    }

    return this.state.default;
  }


  get StringValue(): string {
    if (
        this.state.type === 'array' &&
        (this.state.arrayType === 'string' || this.isNumberArray)
    ) {
      return (this.state.value || []).join(';');
    }

    if (this.state.isConfigType) {
      return JSON.stringify(this.state.value.toJSON());
    }

    if (typeof this.state.value === 'object') {
      return JSON.stringify(this.state.value);
    }

    return this.state.value;
  }

  set StringValue(value: string) {
    if (
        this.state.type === 'array' &&
        (this.state.arrayType === 'string' || this.isNumberArray)
    ) {
      value = value.replace(new RegExp(',', 'g'), ';');
      if (!this.allowSpaces) {
        value = value.replace(new RegExp(' ', 'g'), ';');
      }
      this.state.value = value.split(';').filter((v: string) => v !== '');
      if (this.isNumberArray) {
        this.state.value = this.state.value
            .map((v: string) => parseFloat(v))
            .filter((v: number) => !isNaN(v));
      }
      return;
    }
    if (typeof this.state.value === 'object') {
      this.state.value = JSON.parse(value);
      return;
    }

    this.state.value = value;
    if (this.isNumber) {
      this.state.value = parseFloat(value);
    }

  }

  get AvailableThemes() {
    return [{
      key: 'default',
      value: $localize`default`
    }, ...(this.state.rootConfig as any).__state.availableThemes.value
        .map((th: ThemeConfig) => ({key: th.name, value: th.name}))];
  }


  get SelectedThemeSettings(): {
    theme: string
  } {
    return (this.state.value as ThemeConfig[]).find(th => th.name === (this.state.rootConfig as any).__state.selectedTheme.value) || {theme: 'N/A'};
  }

  get Disabled() {
    if (!this.state?.tags?.uiDisabled) {
      return false;
    }
    return this.state.tags.uiDisabled(this.state.rootConfig, this.settingsService.settings.value);
  }

  ngOnChanges(): void {
    if (!this.state) {
      return;
    }

    // cache type overrides
    this.type = this.state.tags?.uiType || this.state.type;
    this.arrayType = null;
    if (this.state.arrayType === MapLayers) {
      this.arrayType = 'MapLayers';
    } else if (this.state.arrayType === NavigationLinkConfig) {
      this.arrayType = 'NavigationLinkConfig';
    } else if (this.state.arrayType === MapPathGroupConfig) {
      this.arrayType = 'MapPathGroupConfig';
    } else if (this.state.arrayType === MapPathGroupThemeConfig) {
      this.arrayType = 'MapPathGroupThemeConfig';
    } else if (this.state.arrayType === UserConfig) {
      this.arrayType = 'UserConfig';
    } else if (this.state.arrayType === ServerExtensionsEntryConfig) {
      this.arrayType = 'ServerExtensionsEntryConfig';
    } else if (this.state.arrayType === JobScheduleConfig) {
      this.arrayType = 'JobScheduleConfig';
    } else {
      this.arrayType = this.state.arrayType;
    }

    if (this.state.tags?.uiOptions) {
      this.state.isEnumType = true;
    }
    this.uiType = this.arrayType;
    if (CustomSettingsEntries.iS(this.state)) {
      this.uiType = CustomSettingsEntries.getFullName(this.state);
    }
    if (!this.state.isEnumType &&
        !this.state.isEnumArrayType &&
        this.type !== 'boolean' &&
        this.type !== 'SearchQuery' &&
        !CustomSettingsEntries.iS(this.state) &&
        this.arrayType !== 'MapLayers' &&
        this.arrayType !== 'NavigationLinkConfig' &&
        this.arrayType !== 'MapPathGroupConfig' &&
        this.arrayType !== 'ServerExtensionsEntryConfig' &&
        this.arrayType !== 'MapPathGroupThemeConfig' &&
        this.arrayType !== 'JobScheduleConfig-Array' &&
        this.arrayType !== 'UserConfig') {
      this.uiType = 'StringInput';
    }
    if (this.type === this.state.tags?.uiType) {
      this.uiType = this.state.tags?.uiType;
    } else if (this.state.isEnumType) {
      this.uiType = 'EnumType';
    } else if (this.type === 'boolean') {
      this.uiType = 'Boolean';
    } else if (this.state.isEnumArrayType) {
      this.uiType = 'EnumArray';
    }

    this.placeholder = this.state.tags?.hint || this.state.default;

    this.title = '';
    if (this.state.readonly) {
      this.title = $localize`readonly` + ', ';
    }
    this.title += $localize`default value` + ': ' + this.defaultStr;
    this.name = this.state?.tags?.name;
    if (this.name) {
      this.idName =
          this.GUID + this.name.toLowerCase().replace(new RegExp(' ', 'gm'), '-');
    }
    this.isNumberArray =
        this.state.arrayType === 'unsignedInt' ||
        this.state.arrayType === 'integer' ||
        this.state.arrayType === 'float' ||
        this.state.arrayType === 'positiveFloat';
    this.isNumber =
        this.state.type === 'unsignedInt' ||
        this.state.type === 'integer' ||
        this.state.type === 'float' ||
        this.state.type === 'positiveFloat';


    if (this.isNumber) {
      this.HTMLInputType = 'number';
    } else if (this.state.type === 'password') {
      this.HTMLInputType = 'password';
    } else {
      this.HTMLInputType = 'text';
    }
    this.description = this.description || this.state.description;
    if (this.state.tags) {
      if (typeof this.dockerWarning === 'undefined') {
        this.dockerWarning = this.state.tags.dockerSensitive && this.settingsService.settings.value.Environment.isDocker;
      }
      this.name = this.name || this.state.tags.name;
      this.allowSpaces = this.allowSpaces || this.state.tags.uiAllowSpaces;
      this.required = this.required || !this.state.tags.uiOptional;
      this.experimental = this.state.tags.experimental;
    }
  }

  getOptionsView(state: IState & {
    optionsView?: {
      key: number | string;
      value: string | number
    }[]
  }) {
    if (!state.optionsView) {
      const eClass = state.isEnumType
          ? state.type
          : state.arrayType;
      if (state.tags?.uiOptions) {
        state.optionsView = state.tags?.uiOptions.map(o => ({
          key: o,
          value: o + (state.tags?.unit ? state.tags?.unit : '')
        }));
      } else {
        state.optionsView = enumToTranslatedArray(eClass);
      }
    }
    return state.optionsView;
  }

  validate(): ValidationErrors {
    if (
        !this.required ||
        (this.state &&
            typeof this.state.value !== 'undefined' &&
            this.state.value !== null &&
            this.state.value !== '')
    ) {
      return null;
    }
    return {required: true};
  }

  public onChange = (value: unknown): void => {
    // empty
  };

  public onTouched = (): void => {
    // empty
  };
  newThemeName: string;

  public writeValue(obj: IState): void {
    this.state = obj;
    this.ngOnChanges();
  }

  public registerOnChange(fn: (v: never) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  AddNew(): void {
    this.state.value = this.state.value || [];
    if (this.state.type === 'array') {
      if (this.state.isConfigArrayType && this.state.arrayType) {
        this.state.value.push(new this.state.arrayType());
        return;
      }
      this.state.value.push(this.state.value[this.state.value.length - 1]);
    }
  }

  remove(i: number): void {
    (this.state.value as unknown[]).splice(i, 1);
    this.onChange(null);
  }

  /**
   * MapLayer function
   */
  addNewLayer(): void {
    this.state.value.push({
      name: 'Layer-' + this.state.value.length,
      url: '',
    });
  }

  removeLayer(layer: MapLayers): void {
    this.state.value.splice(
        this.state.value.indexOf(layer),
        1
    );
  }


  addNewTheme(): void {
    const availableThemes = (this.state.rootConfig as any).__state.availableThemes;
    if (!this.newThemeName ||
        (availableThemes.value as ThemeConfig[]).find(th => th.name === this.newThemeName)) {
      return;
    }
    this.state.value = this.newThemeName;
    availableThemes.value.push(new availableThemes.arrayType(this.newThemeName, ''));
    this.newThemeName = '';
    this.onChange(null);
    this.hideNewThemeModal();
  }


  removeTheme(): void {
    const availableThemes = (this.state.rootConfig as any).__state.availableThemes;
    const i = (availableThemes.value as ThemeConfig[]).findIndex(th => th.name === this.state.value);
    if (i >= 0) {
      this.state.value = 'default';
      availableThemes.value.splice(i, 1);
      this.onChange(null);
    }

  }

  showNewThemeModal(template: TemplateRef<any>): void {
    this.newThemeModalRef = this.modalService.show(template, {
      class: 'modal-lg',
    });
    document.body.style.paddingRight = '0px';
  }


  showIconModal(template: TemplateRef<any>): void {
    this.iconModal = {};
    this.iconModal.ref = this.modalService.show(template, {
      class: 'modal-lg',
    });
    document.body.style.paddingRight = '0px';
  }


  public hideNewThemeModal(): void {
    this.newThemeModalRef.hide();
    this.newThemeModalRef = null;
  }

  hideIconModal(): void {
    if (!this.iconModal) {
      return;
    }
    this.iconModal.ref.hide();
    delete this.iconModal;
  }

  newSvgFile(event: Event): void {

    const file: File = (event.target as HTMLInputElement).files[0];

    const reader = new FileReader();
    reader.onload = () => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(reader.result as string, 'image/svg+xml');
      try {
        const wb = doc.documentElement.getAttribute('viewBox');
        const items = doc.documentElement.innerHTML;
        this.state.value.items = items;
        this.state.value.viewBox = wb;
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



