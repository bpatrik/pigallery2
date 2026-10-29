import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { NgStyle } from '@angular/common';
import {NgIconComponent} from '@ng-icons/core';
import {UploaderService} from './uploader.service';

@Component({
  selector: 'app-gallery-uploader',
  templateUrl: './uploader.gallery.component.html',
  styleUrl: './uploader.gallery.component.css',
  imports: [
    NgIconComponent,
    NgStyle
]
})
export class UploaderComponent {
  uploaderService = inject(UploaderService);
  private cdr = inject(ChangeDetectorRef);

  public readonly Date = Date;
  @Input() isUploadOver: boolean;
  public showDetails = false;
  private timer: any;

  ngOnInit(): void {
    this.timer = setInterval(() => {
      this.cdr.detectChanges();
    }, 500);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  public toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  public getOverallProgress(): number {
    if (this.uploaderService.uploadProgress.length === 0) {
      return 0;
    }
    const sum = this.uploaderService.uploadProgress.reduce((a, b) => a + b.progress, 0);
    return Math.round(sum / this.uploaderService.uploadProgress.length);
  }

}

