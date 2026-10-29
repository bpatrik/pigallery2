import { Component, Input, TemplateRef, inject } from '@angular/core';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {SearchQueryDTO} from '../../../../../common/entities/SearchQueryDTO';
import { NgIconComponent } from '@ng-icons/core';
import { JsonPipe } from '@angular/common';

@Component({
    selector: 'app-saved-search-popup-btn',
    templateUrl: './saved-search-popup.component.html',
    styleUrl: './saved-search-popup.component.css',
    imports: [NgIconComponent, JsonPipe]
})
export class SavedSearchPopupComponent {
  private modalService = inject(BsModalService);

  @Input() disabled: boolean;
  @Input() savedSearchDTO: { name: string; searchQuery: SearchQueryDTO };
  private modalRef: BsModalRef;

  public async openModal(template: TemplateRef<any>): Promise<void> {
    this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
    document.body.style.paddingRight = '0px';
  }

  public hideModal(): void {
    this.modalRef.hide();
    this.modalRef = null;
  }
}

