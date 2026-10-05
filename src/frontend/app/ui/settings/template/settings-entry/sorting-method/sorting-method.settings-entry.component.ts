import {Component, forwardRef, Input, OnInit} from '@angular/core';
import {ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';
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
  styleUrls: ['./sorting-method.settings-entry.component.css'],
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
  @Input() sortingByEnum: Record<string, number | string> & { [k: number]: string };

  public sortingMethod: SortingMethod;
  public sortingByTypes: { key: number; value: string }[] = [];

  constructor(private notificationService: NotificationService) {
  }

  ngOnInit(): void {
    this.sortingByTypes = enumToTranslatedArray(this.sortingByEnum);
  }

  public onTouched(): void {
    //ignoring
  }

  public writeValue(obj: SortingMethod): void {
    this.sortingMethod = obj;
  }

  registerOnChange(fn: (_: unknown) => void): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.propagateTouch = fn;
  }

  public onChange(): void {
    this.propagateChange(this.sortingMethod);
  }

  validate(): ValidationErrors {
    return {required: true};
  }

  public isBidirectional(value: number) {
    return Utils.isValidEnumInt(SortByDirectionalTypes, value);
  }

  setSortingBy(key: number): void {
    try {
      this.sortingMethod.method = key;
      if (!this.isBidirectional(key)) { // included in enum
        this.sortingMethod.ascending = null;
      } else if (this.sortingMethod.ascending == null) {
        this.sortingMethod.ascending = true;
      }
      this.onChange();
    } catch (e) {
      this.notificationService.error('Can\t set soritng:' + e.message);
    }
  }

  setSortingAscending(ascending: boolean): void {
    this.sortingMethod.ascending = ascending;
    this.onChange();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private propagateChange = (_: SortingMethod): void => {
    //ignoring
  };

  private propagateTouch = (): void => {
    //ignoring
  };
}
