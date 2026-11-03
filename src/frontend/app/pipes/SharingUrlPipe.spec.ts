import {TestBed} from '@angular/core/testing';
import {SharingUrlPipe} from './SharingUrlPipe';
import {ShareService} from '../ui/gallery/share.service';
import {ResponseSharingDTO} from '../../../common/entities/SharingDTO';

describe('SharingUrlPipe', () => {
  it('should return the url of the sharing', () => {
    const getUrl = vi.fn((s: ResponseSharingDTO): string => 'http://localhost/share/' + s.sharingKey);
    TestBed.configureTestingModule({providers: [{provide: ShareService, useValue: {getUrl}}]});
    const pipe = TestBed.runInInjectionContext(() => new SharingUrlPipe());
    const share = {sharingKey: 'árvíztűrő'} as ResponseSharingDTO;
    expect(pipe.transform(share)).toBe('http://localhost/share/árvíztűrő');
    expect(getUrl).toHaveBeenCalledWith(share);
  });
});
