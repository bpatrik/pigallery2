import {Component, Input, TemplateRef, ChangeDetectionStrategy} from '@angular/core';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {SearchQueryDTO} from '../../../../../common/entities/SearchQueryDTO';
import { NgIconComponent } from '@ng-icons/core';
import { JsonPipe } from '@angular/common';

@Component({
    selector: 'app-saved-search-popup-btn',
    templateUrl: './saved-search-popup.component.html',
    styleUrls: ['./saved-search-popup.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgIconComponent, JsonPipe]
})
export class SavedSearchPopupComponent {
  @Input() disabled: boolean;
  @Input() savedSearchDTO: { name: string; searchQuery: SearchQueryDTO };
  private modalRef: BsModalRef;

  constructor(private modalService: BsModalService) {
  }

  public async openModal(template: TemplateRef<any>): Promise<void> {
    this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
    document.body.style.paddingRight = '0px';
  }

  public hideModal(): void {
    this.modalRef.hide();
    this.modalRef = null;
  }
}

