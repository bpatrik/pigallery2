import { Component, forwardRef, OnInit, inject, input, computed, signal } from '@angular/core';
import {ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, type ValidationErrors, Validator} from '@angular/forms';
import {SortByDirectionalTypes, SortingMethod} from '../../../../../../../common/entities/SortingMethods';
import {enumToTranslatedArray} from '../../../../EnumTranslations';
import {AutoCompleteService} from '../../../../gallery/search/autocomplete.service';
import {Utils} from '../../../../../../../common/Utils';
import {BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective} from 'ngx-bootstrap/dropdown';

import {NgIconComponent} from '@ng-icons/core';
import {SortingMethodIconComponent} from '../../../../utils/sorting-method-icon/sorting-method-icon.component';
import {StringifySortingMethod} from '../../../../../pipes/StringifySortingMethod';
import {NotificationService} from '../../../../../model/notification.service';

@Component({
  selector: 'app-settings-entry-sorting-method',
  templateUrl: './sorting-method.settings-entry.component.html',
  styleUrl: './sorting-method.settings-entry.component.css',
  providers: [
    AutoCompleteService,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SortingMethodSettingsEntryComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SortingMethodSettingsEntryComponent),
      multi: true,
    },
  ],
  imports: [
    BsDropdownDirective,
    BsDropdownToggleDirective,
    NgIconComponent,
    SortingMethodIconComponent,
    BsDropdownMenuDirective,
    StringifySortingMethod
]
})
export class SortingMethodSettingsEntryComponent
  implements ControlValueAccessor, Validator, OnInit {
  private notificationService = inject(NotificationService);

  readonly sortingByEnum = input<Record<string, number | string> & Record<number, string>>();

  /**
   * The edited value (part of the settings tree), it is changed in place.
   */
  private model: SortingMethod;
  /**
   * A copy of the model for the view, replaced on every change.
   */
  public readonly sortingMethod = signal<SortingMethod | undefined>(undefined);
  public readonly isBidirectional = computed<boolean>(() =>
    this.isBidirectionalMethod(this.sortingMethod()?.method));
  public sortingByTypes: { key: number; value: string }[] = [];

  ngOnInit(): void {
    this.sortingByTypes = enumToTranslatedArray(this.sortingByEnum() ?? {});
  }

  public onTouched(): void {
    //ignoring
  }

  public writeValue(obj: SortingMethod): void {
    this.model = obj;
    this.updateView();
  }

  registerOnChange(fn: (_: unknown) => void): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.propagateTouch = fn;
  }

  public onChange(): void {
    this.updateView();
    this.propagateChange(this.model);
  }

  validate(): ValidationErrors {
    return {required: true};
  }

  private isBidirectionalMethod(value: number | undefined): boolean {
    return value !== undefined && Utils.isValidEnumInt(SortByDirectionalTypes, value);
  }

  private updateView(): void {
    this.sortingMethod.set(this.model ? {method: this.model.method, ascending: this.model.ascending} : this.model);
  }

  setSortingBy(key: number): void {
    try {
      this.model.method = key;
      if (!this.isBidirectionalMethod(key)) { // included in enum
        this.model.ascending = null;
      } else if (this.model.ascending == null) {
        this.model.ascending = true;
      }
      this.onChange();
    } catch (e) {
      this.notificationService.error('Can\t set soritng:' + e.message);
    }
  }

  setSortingAscending(ascending: boolean): void {
    this.model.ascending = ascending;
    this.onChange();
  }

  private propagateChange = (_: SortingMethod): void => {
    //ignoring
  };

  private propagateTouch = (): void => {
    //ignoring
  };
}
