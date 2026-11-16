import {Component, TemplateRef, effect, inject, untracked, viewChild} from '@angular/core';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {MarkdownComponent} from 'ngx-markdown';
import {ReleaseNotesService} from '../../model/release-notes.service';
import {NgIconComponent} from '@ng-icons/core';
import {Config} from '../../../../common/config/public/Config';

/**
 * The "What's new" popup of the admins. Opens when ReleaseNotesService says so.
 */
@Component({
  selector: 'app-release-notes-popup',
  templateUrl: './release-notes-popup.component.html',
  styleUrl: './release-notes-popup.component.css',
  imports: [MarkdownComponent, NgIconComponent]
})
export class ReleaseNotesPopupComponent {
  private modalService = inject(BsModalService);
  readonly releaseNotesService = inject(ReleaseNotesService);
  readonly releasesUrl = ReleaseNotesService.ReleasesUrl;
  readonly hideSponsorLinks = Config.Server.hideSponsorLinks;
  private readonly modalTemplate = viewChild<TemplateRef<unknown>>('modal');
  private modalRef: BsModalRef | null = null;

  constructor() {
    effect(() => {
      const template = this.modalTemplate();
      const open = this.releaseNotesService.isOpen();
      if (!template) {
        return;
      }
      untracked(() => open ? this.show(template) : this.modalRef?.hide());
    });
  }

  /**
   * The links of the notes (issues, PRs) open in a new tab, so the gallery stays open.
   */
  openLinksInNewTab(notes: HTMLElement): void {
    notes.querySelectorAll('a[href]').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
  }

  close(): void {
    this.releaseNotesService.close().catch(console.error);
  }

  private show(template: TemplateRef<unknown>): void {
    if (this.modalRef) {
      return;
    }
    this.modalRef = this.modalService.show(template, {class: 'modal-lg modal-dialog-scrollable', ariaLabelledBy: 'release-notes-title'});
    this.modalRef.onHidden?.subscribe(() => {
      this.modalRef = null;
      // closed with Esc or a click on the backdrop
      if (this.releaseNotesService.isOpen()) {
        this.close();
      }
    });
  }
}
