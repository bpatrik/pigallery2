import {TestBed} from '@angular/core/testing';
import {Location} from '@angular/common';
import {SpyLocation} from '@angular/common/testing';
import {QueryService} from './query.service';
import {ShareService} from '../ui/gallery/share.service';
import {ContentLoaderService} from '../ui/gallery/contentLoader.service';
import {MediaDTO} from '../../../common/entities/MediaDTO';
import {QueryParams} from '../../../common/QueryParams';

describe('QueryService', () => {
  let service: QueryService;
  let location: SpyLocation;
  const media = {name: 'photo.jpg', directory: {name: 'dir', path: '/'}} as MediaDTO;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {provide: Location, useClass: SpyLocation},
        {provide: ShareService, useValue: {isSharing: (): boolean => false, getSharingKey: (): string | null => null}},
        {provide: ContentLoaderService, useValue: {isSearchResult: (): boolean => false}},
      ]
    });
    service = TestBed.inject(QueryService);
    location = TestBed.inject(Location) as SpyLocation;
  });

  // #470: closing the lightbox goes back to the page it was opened from, so back does not open the photo again
  it('should open the lightbox with a link that closes it with back', () => {
    const link = service.getLightboxLink(media);
    expect(link.queryParams).toEqual({[QueryParams.gallery.photo]: 'photo.jpg'});

    location.go('/gallery/?p=photo.jpg', '', link.state);
    expect(service.lightboxClosesWithBack()).toBe(true);
    expect(service.lightboxRevealsInGrid()).toBe(true);
    expect(service.keepLightboxState()).toEqual({lightboxClosesWithBack: true, lightboxRevealsInGrid: true});
  });

  // the map is the page under the photo: the grid behind it does not scroll to the photo
  it('should open the lightbox from the map without revealing the photo in the grid', () => {
    location.go('/gallery/?p=photo.jpg', '', service.getLightboxLink(media, false).state);
    expect(service.lightboxClosesWithBack()).toBe(true);
    expect(service.lightboxRevealsInGrid()).toBe(false);
    expect(service.keepLightboxState()).toEqual({lightboxClosesWithBack: true, lightboxRevealsInGrid: false});
  });

  it('should not close the lightbox with back when it was opened from somewhere else (e.g. a link)', () => {
    location.go('/gallery/?p=photo.jpg');
    expect(service.lightboxClosesWithBack()).toBe(false);
    expect(service.lightboxRevealsInGrid()).toBe(true);
    expect(service.keepLightboxState()).toEqual({lightboxClosesWithBack: false, lightboxRevealsInGrid: true});
  });
});
