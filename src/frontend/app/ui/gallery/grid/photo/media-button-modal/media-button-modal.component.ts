import { Component, computed, inject, linkedSignal } from '@angular/core';
import {MediaButtonModalData, MediaButtonModalService} from './media-button-modal.service';

import {FormsModule} from '@angular/forms';
import {IClientMediaFields, IMediaRequestBodyData} from '../../../../../../../common/entities/extension/IClientUIConfig';

@Component({
  selector: 'app-media-button-modal',
  host: {
    '(document:keydown)': 'onKeyDown($event)'
  },
  templateUrl: './media-button-modal.component.html',
  styleUrl: './media-button-modal.component.css',
  imports: [FormsModule]
})
export class MediaButtonModalComponent {
  private modalService = inject(MediaButtonModalService);

  readonly modalData = this.modalService.modalData;
  // reset for every new modal; the field inputs edit it in place, the custom fields through setCustomField()
  readonly formData = linkedSignal<IMediaRequestBodyData>(() => {
    const data = this.modalData();
    return data ? this.initFormData(data) : {};
  });

  readonly fieldLabels: Record<IClientMediaFields, string> = {
    title: $localize`Title`,
    caption: $localize`Caption`,
    cameraData: $localize`Camera Data`,
    positionData: $localize`Position Data`,
    faces: $localize`Faces`,
    size: $localize`Size`,
    creationDate: $localize`Creation Date`,
    creationDateOffset: $localize`Creation Date Offset`,
    bitRate: $localize`Bit Rate`,
    duration: $localize`Duration`,
    fileSize: $localize`File Size`,
    fps: $localize`FPS`,
    keywords: $localize`Keywords`
  };

  // the current values of the fields of the modal
  readonly fieldValues = computed((): Partial<Record<IClientMediaFields, string | number>> => {
    const values: Partial<Record<IClientMediaFields, string | number>> = {};
    (this.modalData()?.button?.popup?.fields || []).forEach(field => {
      values[field] = this.getFieldValue(field);
    });
    return values;
  });

  readonly isFormValid = computed((): boolean => {
    const modalData = this.modalData();
    if (!modalData?.button?.popup?.customFields) {
      return true;
    }

    // Check if all required custom fields are properly filled
    for (const field of modalData.button.popup.customFields) {
      if (field.required) {
        const value = this.formData().customFields?.[field.id];

        // For boolean fields, required means it must be checked (true)
        if (field.type === 'boolean' && !value) {
          return false;
        }

        // For string fields, required means not empty
        if (field.type === 'string' && (!value || String(value).trim() === '')) {
          return false;
        }

        // For number fields, required means not null/undefined (0 is valid)
        if (field.type === 'number' && (value === null || value === undefined || value === '')) {
          return false;
        }
      }
    }

    return true;
  });

  getFieldValue(field: IClientMediaFields): string | number {
    const modalData = this.modalData();
    if (!modalData) {
      return '';
    }

    const media = modalData.media;
    const metadata = media.media.metadata;

    switch (field) {
      case 'title':
      case 'caption':
      case 'bitRate':
      case 'creationDate':
      case 'creationDateOffset':
      case 'duration':
      case 'fileSize':
      case 'fps':
        return (metadata[field as keyof typeof metadata] as string | number | undefined) || '';
      case 'cameraData':
      case 'positionData':
      case 'size':
        return JSON.stringify(metadata[field as keyof typeof metadata] || {});
      case 'faces':
      case 'keywords':
        return JSON.stringify(metadata[field as keyof typeof metadata] || []);
      default:
        return '';
    }
  }

  closeModal(): void {
    this.modalService.hideModal();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.modalData()?.visible) {
      this.closeModal();
    }
  }

  executeAction(): void {
    const modalData = this.modalData();
    const formData = this.formData();
    if (modalData && this.isFormValid()) {
      // save value to reuse in the next modal
      if (modalData?.button?.popup?.customFields) {
        modalData.button.popup.customFields.forEach(field => {
          if (field.keepValue) {
            this.modalService.setValue(field.id, formData.customFields?.[field.id]);
          }
        });
      }
      this.modalService.executeButtonAction(
        modalData.button,
        modalData.media,
        formData
      ).catch(console.error);
    }
  }

  setCustomField(id: string, value: string | number | boolean): void {
    this.formData.update((f) => ({...f, customFields: {...f.customFields, [id]: value}}));
  }

  private initFormData(modalData: MediaButtonModalData): IMediaRequestBodyData {
    const formData: IMediaRequestBodyData = {};
    if (modalData.button?.popup?.fields) {
      const fields: Record<string, string | number> = {};
      modalData.button.popup.fields.forEach(field => {
        fields[field] = this.getFieldValue(field);
      });
      formData.fields = fields;
    }
    if (modalData.button?.popup?.customFields) {
      const customFields: Record<string, string | number | boolean> = {};
      modalData.button.popup.customFields.forEach(field => {
        // load last value if we should keep it
        const savedValue = this.modalService.getValue(field.id);
        if (field.keepValue && savedValue !== undefined) {
          customFields[field.id] = savedValue;
          return;
        }
        customFields[field.id] = field.defaultValue ?? this.getDefaultValueForType(field.type);
      });
      formData.customFields = customFields;
    }
    return formData;
  }

  private getDefaultValueForType(type: 'string' | 'number' | 'boolean'): string | number | boolean {
    switch (type) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      default:
        return '';
    }
  }
}
