import {Component, OnDestroy, OnInit, TemplateRef, ChangeDetectionStrategy} from '@angular/core';
import {ContentWrapper} from '../../../../../common/entities/ContentWrapper';
import {NotificationService} from '../../../model/notification.service';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {Subscription} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {QueryParams} from '../../../../../common/QueryParams';
import {ContentLoaderService} from '../contentLoader.service';
import { NgIconComponent } from '@ng-icons/core';
import { FormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';

import { StringifyEnum } from '../../../pipes/StringifyEnum';
import { LightBoxTitleTexts } from '../../../../../common/config/public/ClientConfig';
import {Utils} from '../../../../../common/Utils';

@Component({
    selector: 'app-gallery-photo-frame-builder',
    templateUrl: './photo-frame-builder.gallery.component.html',
    styleUrls: ['./photo-frame-builder.gallery.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
    NgIconComponent,
    FormsModule,
    ClipboardModule,
    StringifyEnum
]
  })
  export class PhotoFrameBuilderGalleryComponent implements OnInit, OnDestroy {
    enabled = true;
    url = '';
    showSettings = false;
    // Options
    autoPollInterval = 5 * 60; // 5m
    loopSlideshow = true;
    captionAlwaysOn = true;
    hideControls = true;
    slideshowSpeed = 5 * 60; // 5m
    // Lightbox title overrides as arrays of enum names (strings)
    topLeftTitle: string[] = [LightBoxTitleTexts[LightBoxTitleTexts.titleOrDirectory]];
    topLeftSubtitle: string[] = [LightBoxTitleTexts[LightBoxTitleTexts.caption]];
    bottomLeftTitle: string[] = [LightBoxTitleTexts[LightBoxTitleTexts.date], LightBoxTitleTexts[LightBoxTitleTexts.location]];
    bottomLeftSubtitle: string[] = [LightBoxTitleTexts[LightBoxTitleTexts.persons]];

    // Enum option names for selects
    readonly LightBoxTitleTextsArr = Utils.enumToArray(LightBoxTitleTexts).map(v=>v.value);

  contentSubscription: Subscription = null;

  modalRef: BsModalRef;

  private readonly subscription: Subscription = null;

  constructor(
      public contentLoaderService: ContentLoaderService,
      private notification: NotificationService,
      private route: ActivatedRoute,
      private router: Router,
      private modalService: BsModalService
  ) {
    // keep for potential future route driven defaults
    this.subscription = this.route.queryParams.subscribe(() => {
      // no-op, we only need router.url at open/build time
    });
  }

  private buildUrl(): void {
    // Build from current router URL, merging our params without affecting actual navigation
    const base = window.location.origin;
    const currentUrl = this.router.url; // includes path + query
    const u = new URL(base + currentUrl);

    // Always autoplay for photo frame
    u.searchParams.set(QueryParams.gallery.lightbox.playback, 'true');

    // Auto polling toggle
    if (typeof this.autoPollInterval != 'undefined') {
      u.searchParams.set(QueryParams.gallery.autoPollInterval,
        String(parseInt(this.autoPollInterval as unknown as any, 10)));
    } else {
      u.searchParams.delete(QueryParams.gallery.autoPollInterval);
    }

    // Loop slideshow toggle
    if (this.loopSlideshow) {
      u.searchParams.set(QueryParams.gallery.lightbox.loopSlideshow, 'true');
    } else {
      u.searchParams.delete(QueryParams.gallery.lightbox.loopSlideshow);
    }

    // Captions always on
    if (this.captionAlwaysOn) {
      u.searchParams.set(QueryParams.gallery.lightbox.captionAlwaysOn, 'true');
    } else {
      u.searchParams.delete(QueryParams.gallery.lightbox.captionAlwaysOn);
    }

    // Hide controls
    if (this.hideControls) {
      u.searchParams.set(QueryParams.gallery.lightbox.controllersDimmed, 'true');
    } else {
      u.searchParams.delete(QueryParams.gallery.lightbox.controllersDimmed);
    }


    // Slideshow speed (in seconds)
    if (this.slideshowSpeed && this.slideshowSpeed > 0) {
      u.searchParams.set(
        QueryParams.gallery.lightbox.slideshowSpeed,
        String(parseInt(this.slideshowSpeed as unknown as any, 10))
      );
    } else {
      u.searchParams.delete(QueryParams.gallery.lightbox.slideshowSpeed);
    }

    // Lightbox title overrides (serialize arrays; omit NONE/empty)
    const titles = QueryParams.gallery.lightbox.titles;
    const setOrDelete = (key: string, parts: string[]) => {
      const cleaned = (parts || [])
        .map(v => (v || '').trim())
        .filter(v => v && v !== 'NONE');
      const val = cleaned.map(v => v.toLowerCase()).join(',');
      if (val && val.length > 0) {
        u.searchParams.set(key, val);
      } else {
        u.searchParams.delete(key);
      }
    };
    const NONE = LightBoxTitleTexts[LightBoxTitleTexts.NONE];
    this.topLeftTitle = [...this.topLeftTitle.filter(v => v !== NONE), NONE];
    this.topLeftSubtitle =  [...this.topLeftSubtitle.filter(v => v !== NONE), NONE];
    this.bottomLeftTitle = [...this.bottomLeftTitle.filter(v => v !== NONE), NONE];
    this.bottomLeftSubtitle = [...this.bottomLeftSubtitle.filter(v => v !== NONE), NONE];
    setOrDelete(titles.topLeftTitle, this.topLeftTitle);
    setOrDelete(titles.topLeftSubTitle, this.topLeftSubtitle);
    setOrDelete(titles.bottomLeftTitle, this.bottomLeftTitle);
    setOrDelete(titles.bottomLeftSubTitle, this.bottomLeftSubtitle);

    this.url = u.href;
  }

  onOptionsChange(): void {
    this.buildUrl();
  }
  trackByIndex(index: number): number {
    return index;
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }


  ngOnInit(): void {
    this.contentSubscription = this.contentLoaderService.content.subscribe(
        (content: ContentWrapper) => {
          this.enabled = !!(content?.directory || content?.searchResult);
          if (!this.enabled) {
            return;
          }
          // this.data.directory = Utils.concatUrls((<DirectoryDTO>content.directory).path, (<DirectoryDTO>content.directory).name);
        }
    );
  }

  ngOnDestroy(): void {
    if (this.contentSubscription !== null) {
      this.contentSubscription.unsubscribe();
    }

    if (this.subscription !== null) {
      this.subscription.unsubscribe();
    }
  }

  openModal(template: TemplateRef<unknown>): boolean {
    if (!this.enabled) {
      return;
    }
    if (this.modalRef) {
      this.modalRef.hide();
    }

    this.modalRef = this.modalService.show(template, {class: 'modal-lg'});
    document.body.style.paddingRight = '0px';
    this.buildUrl();
    return false;
  }

  onCopy(): void {
    this.notification.success($localize`Url has been copied to clipboard`);
  }

  public hideModal(): void {
    this.modalRef.hide();
    this.modalRef = null;
  }
}
