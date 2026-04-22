import {GridMedia} from './GridMedia';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {Config} from '../../../../../common/config/public/Config';

describe('GridMedia', () => {

  describe('isLivePhoto', () => {
    it('should return true when liveVideoPath is set', () => {
      const media = {
        name: 'IMG_001.HEIC',
        directory: {name: 'photos', path: '/'},
        metadata: {size: {width: 100, height: 100}},
        liveVideoPath: 'photos/IMG_001_HEVC.MOV',
      } as any;
      const gm = new GridMedia(media, 100, 100, 0);
      expect(gm.isLivePhoto()).toBeTrue();
    });

    it('should return false when liveVideoPath is not set', () => {
      const media = {
        name: 'IMG_002.HEIC',
        directory: {name: 'photos', path: '/'},
        metadata: {size: {width: 100, height: 100}},
      } as PhotoDTO;
      const gm = new GridMedia(media, 100, 100, 0);
      expect(gm.isLivePhoto()).toBeFalse();
    });
  });

  describe('getLiveVideoPath', () => {
    it('should return null when no liveVideoPath', () => {
      const media = {
        name: 'IMG_002.HEIC',
        directory: {name: 'photos', path: '/'},
        metadata: {size: {width: 100, height: 100}},
      } as PhotoDTO;
      const gm = new GridMedia(media, 100, 100, 0);
      expect(gm.getLiveVideoPath()).toBeNull();
    });

    it('should build the correct video URL', () => {
      const media = {
        name: 'IMG_001.HEIC',
        directory: {name: 'photos', path: '/'},
        metadata: {size: {width: 100, height: 100}},
        liveVideoPath: 'photos/IMG_001_HEVC.MOV',
      } as any;
      const gm = new GridMedia(media, 100, 100, 0);
      const path = gm.getLiveVideoPath();
      expect(path).toContain('/gallery/content/');
      expect(path).toContain('photos/IMG_001_HEVC.MOV');
      expect(path).toContain('/bestFit');
    });

    it('should encode special characters in the path', () => {
      const media = {
        name: 'IMG 001.HEIC',
        directory: {name: 'photos', path: '/'},
        metadata: {size: {width: 100, height: 100}},
        liveVideoPath: 'photos/IMG #1$?.MOV',
      } as any;
      const gm = new GridMedia(media, 100, 100, 0);
      const path = gm.getLiveVideoPath();
      expect(path).not.toContain('#');
      expect(path).not.toContain('$');
      expect(path).not.toContain('?');
      expect(path).toContain('%23');
      expect(path).toContain('%24');
      expect(path).toContain('%3F');
    });
  });
});
