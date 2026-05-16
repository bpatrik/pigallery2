/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import {expect} from 'chai';
import {Config} from '../../../../src/common/config/private/Config';
import {GalleryMWs} from '../../../../src/backend/middlewares/GalleryMWs';
import {ContentWrapper} from '../../../../src/common/entities/ContentWrapper';
import {MediaDTO} from '../../../../src/common/entities/MediaDTO';
import {ParentDirectoryDTO} from '../../../../src/common/entities/DirectoryDTO';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';

declare const before: any;
declare const describe: any;
declare const it: any;

function makePhoto(name: string, dirPath: string, dirName: string, contentIdentifier?: string): MediaDTO {
  return {
    id: 0,
    name,
    directory: {path: dirPath, name: dirName},
    metadata: {
      size: {width: 100, height: 100},
      creationDate: Date.now(),
      fileSize: 1000,
      contentIdentifier,
    } as any,
  } as MediaDTO;
}

function makeVideo(name: string, dirPath: string, dirName: string, contentIdentifier?: string): MediaDTO {
  return {
    id: 0,
    name,
    directory: {path: dirPath, name: dirName},
    metadata: {
      size: {width: 100, height: 100},
      creationDate: Date.now(),
      fileSize: 1000,
      bitRate: 1000,
      duration: 3000,
      fps: 30,
      contentIdentifier,
    } as any,
  } as MediaDTO;
}

describe('GalleryMWs', () => {
  before(() => {
    Config.loadSync();
    Config.Database.type = DatabaseType.sqlite;
    Config.Extensions.enabled = false;
  });

  describe('cleanUpGalleryResults - Live Photo pairing', () => {
    it('should pair photo with companion video by contentIdentifier', (done: (err?: any) => void) => {
      Config.Media.LivePhoto.enabled = true;
      Config.Media.Video.enabled = true;

      const photo = makePhoto('IMG_7943.HEIC', '.', 'vacation', '42A4A5ED-897B-46BF-84D2-FF2D0E90D7EB');
      const video = makeVideo('IMG_7943_HEVC.MOV', '.', 'vacation', '42A4A5ED-897B-46BF-84D2-FF2D0E90D7EB');

      const cw: ContentWrapper = {
        directory: {
          path: '.',
          name: 'vacation',
          media: [photo, video],
          directories: [],
          metaFile: [],
        } as ParentDirectoryDTO,
        searchResult: null,
      };

      const req: any = {resultPipe: cw};
      const next: any = (err: any) => {
        try {
          expect(err).to.be.undefined;
          const packed = req.resultPipe;
          expect(packed).to.not.be.undefined;
          // Packed format uses 'n' for name, 'l' for liveVideoPath
          expect(packed.directory.media.length).to.equal(1);
          expect(packed.directory.media[0]['n']).to.equal('IMG_7943.HEIC');
          expect(packed.directory.media[0]['l']).to.equal('vacation/IMG_7943_HEVC.MOV');
          // contentIdentifier should be stripped from the response
          expect(packed.directory.media[0]['m']?.contentIdentifier).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      GalleryMWs.cleanUpGalleryResults(req, null, next);
    });

    it('should not pair when contentIdentifiers do not match', (done: (err?: any) => void) => {
      Config.Media.LivePhoto.enabled = true;
      Config.Media.Video.enabled = true;

      const photo = makePhoto('IMG_7943.HEIC', '.', 'vacation', 'AAAA-BBBB');
      const video = makeVideo('IMG_7943_HEVC.MOV', '.', 'vacation', 'CCCC-DDDD');

      const cw: ContentWrapper = {
        directory: {
          path: '.',
          name: 'vacation',
          media: [photo, video],
          directories: [],
          metaFile: [],
        } as ParentDirectoryDTO,
        searchResult: null,
      };

      const req: any = {resultPipe: cw};
      const next: any = (err: any) => {
        try {
          expect(err).to.be.undefined;
          const packed = req.resultPipe;
          expect(packed.directory.media.length).to.equal(2);
          expect(packed.directory.media[0]['l']).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      GalleryMWs.cleanUpGalleryResults(req, null, next);
    });

    it('should not pair when Live Photo is disabled', (done: (err?: any) => void) => {
      Config.Media.LivePhoto.enabled = false;
      Config.Media.Video.enabled = true;

      const photo = makePhoto('IMG_7943.HEIC', '.', 'vacation', '42A4A5ED-897B-46BF-84D2-FF2D0E90D7EB');
      const video = makeVideo('IMG_7943_HEVC.MOV', '.', 'vacation', '42A4A5ED-897B-46BF-84D2-FF2D0E90D7EB');

      const cw: ContentWrapper = {
        directory: {
          path: '.',
          name: 'vacation',
          media: [photo, video],
          directories: [],
          metaFile: [],
        } as ParentDirectoryDTO,
        searchResult: null,
      };

      const req: any = {resultPipe: cw};
      const next: any = (err: any) => {
        try {
          expect(err).to.be.undefined;
          const packed = req.resultPipe;
          // Both media should remain, no pairing
          expect(packed.directory.media.length).to.equal(2);
          expect(packed.directory.media[0]['l']).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      GalleryMWs.cleanUpGalleryResults(req, null, next);
      Config.Media.LivePhoto.enabled = true;
    });

    it('should pair in search results', (done: (err?: any) => void) => {
      Config.Media.LivePhoto.enabled = true;
      Config.Media.Video.enabled = true;

      const photo = makePhoto('IMG_7943.HEIC', '.', 'vacation', '42A4A5ED-897B-46BF-84D2-FF2D0E90D7EB');
      const video = makeVideo('IMG_7943_HEVC.MOV', '.', 'vacation', '42A4A5ED-897B-46BF-84D2-FF2D0E90D7EB');

      const cw: ContentWrapper = {
        directory: null,
        searchResult: {
          searchQuery: {type: 1, text: 'test'} as any,
          media: [photo, video],
          directories: [],
          metaFile: [],
          resultOverflow: false,
        },
      };

      const req: any = {resultPipe: cw};
      const next: any = (err: any) => {
        try {
          expect(err).to.be.undefined;
          const packed = req.resultPipe;
          expect(packed.searchResult.media.length).to.equal(1);
          expect(packed.searchResult.media[0]['n']).to.equal('IMG_7943.HEIC');
          expect(packed.searchResult.media[0]['l']).to.equal('vacation/IMG_7943_HEVC.MOV');
          // contentIdentifier should be stripped from the response
          expect(packed.searchResult.media[0]['m']?.contentIdentifier).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      GalleryMWs.cleanUpGalleryResults(req, null, next);
    });

    it('should keep unpaired videos in results', (done: (err?: any) => void) => {
      Config.Media.LivePhoto.enabled = true;
      Config.Media.Video.enabled = true;

      const photo = makePhoto('IMG_7943.HEIC', '.', 'vacation', '42A4A5ED-897B-46BF-84D2-FF2D0E90D7EB');
      const video = makeVideo('IMG_7943_HEVC.MOV', '.', 'vacation', '42A4A5ED-897B-46BF-84D2-FF2D0E90D7EB');
      const regularVideo = makeVideo('family_clip.mp4', '.', 'vacation');

      const cw: ContentWrapper = {
        directory: {
          path: '.',
          name: 'vacation',
          media: [photo, video, regularVideo],
          directories: [],
          metaFile: [],
        } as ParentDirectoryDTO,
        searchResult: null,
      };

      const req: any = {resultPipe: cw};
      const next: any = (err: any) => {
        try {
          expect(err).to.be.undefined;
          const packed = req.resultPipe;
          // Photo + regular video = 2 items (companion video filtered)
          expect(packed.directory.media.length).to.equal(2);
          const names = packed.directory.media.map((m: any) => m['n']);
          expect(names).to.include('IMG_7943.HEIC');
          expect(names).to.include('family_clip.mp4');
          expect(names).to.not.include('IMG_7943_HEVC.MOV');
          done();
        } catch (err) {
          done(err);
        }
      };
      GalleryMWs.cleanUpGalleryResults(req, null, next);
    });
  });
});
