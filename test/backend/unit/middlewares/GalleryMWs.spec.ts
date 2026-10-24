/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import * as path from 'path';
import {expect} from 'chai';
import {Config} from '../../../../src/common/config/private/Config';
import {GalleryMWs} from '../../../../src/backend/middlewares/GalleryMWs';
import {ContentWrapper} from '../../../../src/common/entities/ContentWrapper';
import {MediaDTO} from '../../../../src/common/entities/MediaDTO';
import {ParentDirectoryDTO} from '../../../../src/common/entities/DirectoryDTO';
import {DatabaseType} from '../../../../src/common/config/private/PrivateConfig';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {GalleryManager} from '../../../../src/backend/model/database/GalleryManager';
import {promises as fsp} from 'fs';
import {DirectoryAccess, DirectoryAccessTypes} from '../../../../src/backend/model/DirectoryAccess';
import {SessionContext} from '../../../../src/backend/model/SessionContext';
import {AuthenticationMWs} from '../../../../src/backend/middlewares/user/AuthenticationMWs';
import {ErrorCodes, ErrorDTO} from '../../../../src/common/entities/Error';
import {DirectorySearch, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../src/common/SearchQueryUtils';

declare const before: any;
declare const beforeEach: any;
declare const afterEach: any;
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
          expect(packed.directory.media[0]['l']).to.equal(path.join('vacation', 'IMG_7943_HEVC.MOV'));
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

    it('should not pair when Live Photo is disabled but should strip contentIdentifier', (done: (err?: any) => void) => {
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
          // contentIdentifier should still be stripped from the response
          expect(packed.directory.media[0]['m']?.contentIdentifier).to.be.undefined;
          expect(packed.directory.media[1]['m']?.contentIdentifier).to.be.undefined;
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
          expect(packed.searchResult.media[0]['l']).to.equal(path.join('vacation','IMG_7943_HEVC.MOV'));
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

  describe('parseSearchQuery', () => {
    it('should parse URLified search query', (done: (err?: any) => void) => {
      const originalQuery: TextSearch = {
        type: SearchQueryTypes.any_text,
        value: '',
      };
      const req: any = {
        params: {
          searchQueryDTO: SearchQueryUtils.urlify(originalQuery),
        },
      };
      GalleryMWs.parseSearchQuery(req, null, (err?: any) => {
        try {
          expect(err).to.be.undefined;
          expect(req.resultPipe).to.deep.equal(originalQuery);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should parse full JSON search query', (done: (err?: any) => void) => {
      const originalQuery: TextSearch = {
        type: SearchQueryTypes.keyword,
        value: 'Landscape',
        matchType: TextSearchQueryMatchTypes.exact_match,
      };
      const req: any = {
        params: {
          searchQueryDTO: JSON.stringify(originalQuery),
        },
      };
      GalleryMWs.parseSearchQuery(req, null, (err?: any) => {
        try {
          expect(err).to.be.undefined;
          expect(req.resultPipe).to.deep.equal(originalQuery);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should return INPUT_ERROR on invalid JSON', (done: (err?: any) => void) => {
      const req: any = {
        params: {
          searchQueryDTO: '{invalid-json',
        },
      };
      GalleryMWs.parseSearchQuery(req, null, (err?: any) => {
        try {
          expect(err).to.not.be.undefined;
          expect(err.code).to.equal(ErrorCodes.INPUT_ERROR);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe('listDirectory - directory access', () => {
    let origGalleryManager: GalleryManager;
    let origStat: typeof fsp.stat;
    let listArgs: any[];

    const dq = (value: string): DirectorySearch =>
      ({type: SearchQueryTypes.directory, value, matchType: TextSearchQueryMatchTypes.exact_match});

    const sessionContext = (user: any, access: Partial<DirectoryAccess> = {}): SessionContext => {
      const c = new SessionContext();
      c.user = user;
      c.directoryAccess = new DirectoryAccess(c, access);
      return c;
    };

    const callListDirectory = async (directory: string, context: SessionContext, directoryAccess?: DirectoryAccessTypes) => {
      const req: any = {session: {context}, params: {directory}, query: {}, directoryAccess};
      let status: number = null;
      const res: any = {
        status: (s: number) => {
          status = s;
          return res;
        }
      };
      let nextArgs: any[] = null;
      await GalleryMWs.listDirectory(req, res, (...args: any[]) => {
        nextArgs = args;
      });
      return {req, status, nextArgs};
    };

    beforeEach(() => {
      origGalleryManager = ObjectManagers.getInstance().GalleryManager;
      origStat = fsp.stat;
      listArgs = null;
      (fsp as any).stat = async () => ({isDirectory: () => true});
      ObjectManagers.getInstance().GalleryManager = {
        listDirectory: async (...args: any[]) => {
          listArgs = args;
          return {name: 'sub', path: 'public/', directories: [], media: [], metaFile: []} as any;
        }
      } as unknown as GalleryManager;
    });

    afterEach(() => {
      ObjectManagers.getInstance().GalleryManager = origGalleryManager;
      (fsp as any).stat = origStat;
    });

    it('answers not existing directories the same way as not available ones', async () => {
      (fsp as any).stat = async () => {
        throw new Error('ENOENT');
      };
      const notExisting = await callListDirectory('not_existing', sessionContext({}));
      expect(notExisting.status).to.equal(404);
      expect((notExisting.nextArgs[0] as ErrorDTO).code).to.equal(ErrorCodes.DIRECTORY_NOT_FOUND);
      expect(listArgs).to.be.null;

      const res: any = {
        status: (s: number) => {
          res.statusCode = s;
          return res;
        }
      };
      let notAvailableArgs: any[] = null;
      AuthenticationMWs.directoryNotFound(res, (...args: any[]) => {
        notAvailableArgs = args;
      });
      expect(res.statusCode).to.equal(notExisting.status);
      expect(notAvailableArgs).to.deep.equal(notExisting.nextArgs);
    });

    it('lists metafiles only for available directories', async () => {
      await callListDirectory('public', sessionContext({}), DirectoryAccessTypes.available);
      expect(listArgs[4].withMetaFiles).to.be.true;
      await callListDirectory('public', sessionContext({}), DirectoryAccessTypes.parent);
      expect(listArgs[4].withMetaFiles).to.be.false;
    });

    it('does not let sharing without directory query trigger indexing', async () => {
      await callListDirectory('public', sessionContext({}), DirectoryAccessTypes.available);
      expect(listArgs[4].allowIndexing).to.be.true;
      await callListDirectory('public', sessionContext({usedSharingKey: 'key'}, {byPhotos: true}), DirectoryAccessTypes.available);
      expect(listArgs[4].allowIndexing).to.be.false;
    });

    it('sends the available parents', async () => {
      const r = await callListDirectory('a/b/c', sessionContext({}, {blockList: [dq('a')]}), DirectoryAccessTypes.available);
      // root, a, a/b -> a is blocked
      expect(r.req.resultPipe.directory.availableParents).to.deep.equal([true, false, true]);
    });
  });
});
