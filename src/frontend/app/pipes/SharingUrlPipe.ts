import {Pipe, PipeTransform, inject} from '@angular/core';
import {ResponseSharingDTO} from '../../../common/entities/SharingDTO';
import {ShareService} from '../ui/gallery/share.service';

@Pipe({
  name: 'sharingUrl'
})
export class SharingUrlPipe implements PipeTransform {
  private shareService = inject(ShareService);

  transform(share: ResponseSharingDTO): string {
    return this.shareService.getUrl(share);
  }
}
