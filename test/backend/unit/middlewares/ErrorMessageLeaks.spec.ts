import {expect} from 'chai';
import {ThumbnailGeneratorMWs} from '../../../../src/backend/middlewares/thumbnail/ThumbnailGeneratorMWs';
import {GalleryMWs} from '../../../../src/backend/middlewares/GalleryMWs';
import {PhotoProcessing} from '../../../../src/backend/model/fileaccess/fileprocessing/PhotoProcessing';
import {ThumbnailSourceType} from '../../../../src/backend/model/fileaccess/PhotoWorker';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {SearchManager} from '../../../../src/backend/model/database/SearchManager';
import {ErrorDTO} from '../../../../src/common/entities/Error';
import {Config} from '../../../../src/common/config/private/Config';
import {TestHelper} from '../../../TestHelper';

/**
 * Error messages are sent to every user (also to guests of a sharing link):
 * they must not tell where the photos are on the server or how the DB failed.
 * The details (only for developers) and the server log keep those.
 */
describe('Error messages of the gallery', () => {
  before(TestHelper.resetConfig);

  const errorOf = async (mw: (req: never, res: never, next: (err?: unknown) => void) => Promise<void>, req: unknown): Promise<ErrorDTO> => {
    let error: unknown;
    await mw(req as never, {} as never, (err?: unknown) => {
      error = err;
    });
    expect(error).to.be.instanceOf(ErrorDTO);
    return error as ErrorDTO;
  };

  describe('thumbnail generation', () => {
    let origGenerate: typeof PhotoProcessing.generateThumbnail;
    beforeEach(() => {
      origGenerate = PhotoProcessing.generateThumbnail;
      PhotoProcessing.generateThumbnail = (): Promise<string> => Promise.reject(new Error('Input file is missing'));
    });
    afterEach(() => {
      PhotoProcessing.generateThumbnail = origGenerate;
    });

    const req = (): unknown => ({
      resultPipe: '/srv/private/photos/Summer/beach.jpg',
      params: {mediaPath: 'Summer/beach.jpg'},
    });

    for (const [name, mw] of [
      ['thumbnail', ThumbnailGeneratorMWs.generateThumbnailFactory(ThumbnailSourceType.Photo)],
      ['icon', ThumbnailGeneratorMWs.generateIconFactory(ThumbnailSourceType.Photo)],
    ] as const) {
      it('should not send the absolute path of the ' + name, async () => {
        const error = await errorOf(mw, req());
        expect(error.message).to.not.contain('/srv/private');
        expect(error.message).to.contain('Summer/beach.jpg');
      });
    }
  });

  describe('random photo', () => {
    let origSearchManager: SearchManager;
    beforeEach(() => {
      Config.RandomPhoto.enabled = true;
      origSearchManager = ObjectManagers.getInstance().SearchManager;
      ObjectManagers.getInstance().SearchManager = {
        getNMedia: (): Promise<never> => Promise.reject(new Error('SQLITE_ERROR: no such table: media_entity'))
      } as unknown as SearchManager;
    });
    afterEach(() => {
      ObjectManagers.getInstance().SearchManager = origSearchManager;
    });

    it('should not send the DB error', async () => {
      const error = await errorOf(GalleryMWs.getRandomImage, {resultPipe: {}, params: {}, session: {context: {}}});
      expect(error.details).to.be.instanceOf(Error); // the DB error, not a missing session
      expect(error.message).to.not.contain('SQLITE');
    });
  });
});
