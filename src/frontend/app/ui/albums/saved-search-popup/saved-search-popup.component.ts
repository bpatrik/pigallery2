import {Component, Input, TemplateRef} from '@angular/core';
import {BsModalService} from 'ngx-bootstrap/modal';
import {BsModalRef} from 'ngx-bootstrap/modal/bs-modal-ref.service';
import {SearchQueryDTO} from '../../../../../common/entities/SearchQueryDTO';

@Component({
  selector: 'app-saved-search-popup-btn',
  templateUrl: './saved-search-popup.component.html',
  styleUrls: ['./saved-search-popup.component.css'],
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

