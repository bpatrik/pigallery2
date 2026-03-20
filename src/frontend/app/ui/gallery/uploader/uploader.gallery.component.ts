import {ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {NgFor, NgIf, NgStyle} from '@angular/common';
import {NgIconComponent} from '@ng-icons/core';
import {UploaderService} from './uploader.service';

@Component({
  selector: 'app-gallery-uploader',
  templateUrl: './uploader.gallery.component.html',
  styleUrls: ['./uploader.gallery.component.css'],
  imports: [
    NgIf,
    NgFor,
    NgIconComponent,
    NgStyle,
  ]
})
export class UploaderComponent {
  public readonly Date = Date;
  @Input() isUploadOver: boolean;
  public showDetails = false;
  private timer: any;

  constructor(public uploaderService: UploaderService,
              private cdr: ChangeDetectorRef) {
  }

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

