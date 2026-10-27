import {MediaIcon} from './MediaIcon';
import {Utils} from '../../../../common/Utils';
import {MediaDTO} from '../../../../common/entities/MediaDTO';

describe('MediaIcon', () => {
  const icon = new MediaIcon({name: 'a.jpg'} as MediaDTO);
  const closest = (n: number): number => Utils.findClosestinSorted(n, MediaIcon.sortedThumbnailSizes);

  it('should pick the thumbnail size for the device pixels of the area', () => {
    spyOnProperty(window, 'devicePixelRatio').and.returnValue(1);
    expect(icon.getMediaSize(300, 200)).toBe(closest(300));
    (Object.getOwnPropertyDescriptor(window, 'devicePixelRatio').get as jasmine.Spy).and.returnValue(2.6);
    expect(icon.getMediaSize(300, 200)).toBe(closest(780));
    expect(icon.getMediaSize(200, 300)).toBe(closest(780));
  });
});
