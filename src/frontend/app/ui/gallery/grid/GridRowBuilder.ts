import {MediaDTO} from '../../../../../common/entities/MediaDTO';

export class GridRowBuilder {
  private photoRow: MediaDTO[] = [];

  private photoIndex = 0; // index of the last pushed media to the photoRow

  constructor(
      private photos: MediaDTO[],
      private startIndex: number,
      private photoMargin: number,
      private containerWidth: number
  ) {
    this.photoIndex = startIndex;
    if (this.containerWidth <= 0) {
      throw new Error(
          'container width cant be <=0, got:' + this.containerWidth
      );
    }
  }

  public addPhotos(num: number): void {
    for (let i = 0; i < num; i++) {
      this.addPhoto();
    }
  }

  public removePhoto(): boolean {
    if (this.photoIndex - 1 < this.startIndex) {
      return false;
    }
    this.photoIndex--;
    this.photoRow.pop();
    return true;
  }

  public getPhotoRow(): MediaDTO[] {
    return this.photoRow;
  }

  public adjustRowHeightBetween(minHeight: number, maxHeight: number): void {
    while (this.calcRowHeight() > maxHeight && this.addPhoto() === true) {
      // row too high -> add more images
    }

    while (this.calcRowHeight() < minHeight && this.removePhoto() === true) {
      // roo too small -> remove images
    }

    // keep at least one media int thr row
    if (this.photoRow.length <= 0) {
      this.addPhoto();
    }
  }

  public calcRowHeight(): number {
    let width = 0;
    for (const item of this.photoRow) {
      const size = item.metadata.size;
      width += (size.width / size.height) || 1; // summing up aspect ratios, NaN should be treated as square photo
    }
    const height =
        (this.containerWidth -
            this.photoRow.length * (this.photoMargin * 2) -
            1) /
        width; // cant be equal -> width-1

    return height + this.photoMargin * 2;
  }


  private addPhoto(): boolean {
    if (this.photoIndex + 1 > this.photos.length) {
      return false;
    }
    this.photoRow.push(this.photos[this.photoIndex]);
    this.photoIndex++;
    return true;
  }
}
