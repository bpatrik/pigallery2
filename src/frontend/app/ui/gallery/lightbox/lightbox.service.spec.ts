import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject} from 'rxjs';

import {LightboxService} from './lightbox.service';
import {QueryParams} from '../../../../../common/QueryParams';

describe('LightboxService', () => {
  let queryParams: BehaviorSubject<Record<string, string>>;

  beforeEach(() => {
    queryParams = new BehaviorSubject<Record<string, string>>({
      [QueryParams.gallery.lightbox.playback]: 'true',
      [QueryParams.gallery.lightbox.loopSlideshow]: 'true',
      [QueryParams.gallery.lightbox.slideshowSpeed]: '2',
    });
    TestBed.configureTestingModule({
      providers: [
        {provide: ActivatedRoute, useValue: {queryParams}},
        {provide: Router, useValue: {navigate: () => Promise.resolve(true)}},
      ]
    });
  });

  it('should follow the URL', () => {
    const service = TestBed.inject(LightboxService);

    expect(service.playback()).toBe(true);
    expect(service.loopSlideshow()).toBe(true);
    expect(service.slideshowSpeed()).toBe(2);

    queryParams.next({});
    expect(service.playback()).toBe(false);
    // the other settings are kept without their parameter
    expect(service.loopSlideshow()).toBe(true);
  });
});
