import { Component, ElementRef, HostListener, Input, OnChanges, inject } from '@angular/core';
import {DeviceDetectorService} from 'ngx-device-detector';
import {SubDirectoryDTO} from '../../../../../common/entities/DirectoryDTO';

import { GalleryDirectoryComponent } from './directory/directory.gallery.component';

@Component({
    selector: 'app-gallery-directories',
    templateUrl: './directories.component.html',
    styleUrl: './directories.component.css',
    imports: [GalleryDirectoryComponent]
})
export class DirectoriesComponent implements OnChanges {
  private container = inject(ElementRef);
  private deviceService = inject(DeviceDetectorService);

  @Input() directories: SubDirectoryDTO[];
  size: number;
  isDesktop: boolean;

  constructor() {
    this.isDesktop = this.deviceService.isDesktop();
  }

  ngOnChanges(): void {
    this.updateSize();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateSize();
  }

  private updateSize(): void {
    if (!this.container?.nativeElement?.clientWidth) {
      return;
    }
    const directoryMargin = 2; // 2px margin on both sides
    const containerWidth =
        this.container.nativeElement.clientWidth - 1; // the browser sometimes makes some rounding error. Sacrifice 1px to make that error up.

    if (!this.isDesktop && window.innerWidth < window.innerHeight) {
      // On portrait mode, show 2 directories side by side with some padding
      this.size = Math.floor(containerWidth / 2 - (directoryMargin * 2));
    } else {
      const targetSize = 220 + directoryMargin;
      this.size = Math.floor(containerWidth / Math.round((containerWidth / targetSize)) - directoryMargin * 2);
    }
  }
}
