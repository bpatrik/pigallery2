import {SearchManager} from '../../../../../src/backend/model/database/SearchManager';
import {DBTestHelper} from '../../../DBTestHelper';
import {SearchQueryDTO, SearchQueryTypes, TextSearch} from '../../../../../src/common/entities/SearchQueryDTO';
import {IndexingManager} from '../../../../../src/backend/model/database/IndexingManager';
import {DirectoryBaseDTO, ParentDirectoryDTO, SubDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {TestHelper} from '../../../../TestHelper';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {GalleryManager} from '../../../../../src/backend/model/database/GalleryManager';
import {Connection} from 'typeorm';
import {PhotoDTO} from '../../../../../src/common/entities/PhotoDTO';
import {VideoDTO} from '../../../../../src/common/entities/VideoDTO';
import {FileDTO} from '../../../../../src/common/entities/FileDTO';
import {CoverManager} from '../../../../../src/backend/model/database/CoverManager';
import {Config} from '../../../../../src/common/config/private/Config';
import {SortByTypes} from '../../../../../src/common/entities/SortingMethods';
import {Utils} from '../../../../../src/common/Utils';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {DirectoryEntity} from '../../../../../src/backend/model/database/enitites/DirectoryEntity';
import {ClientSortingConfig} from '../../../../../src/common/config/public/ClientConfig';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deepEqualInAnyOrder = require('deep-equal-in-any-order');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chai = require('chai');

chai.use(deepEqualInAnyOrder);
const {expect} = chai;

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
declare const before: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe(); // fake it os IDE plays nicely (recognize the test)


class IndexingManagerTest extends IndexingManager {

  public async saveToDB(scannedDirectory: ParentDirectoryDTO): Promise<void> {
    return super.saveToDB(scannedDirectory);
  }
}

class SearchManagerTest extends SearchManager {

  public flattenSameOfQueries(query: SearchQueryDTO): SearchQueryDTO {
    return super.flattenSameOfQueries(query);
  }

}

class GalleryManagerTest extends GalleryManager {

  public async getDirIdAndTime(connection: Connection, directoryName: string, directoryParent: string) {
    return super.getDirIdAndTime(connection, directoryName, directoryParent);
  }

  public async getParentDirFromId(connection: Connection, dir: number): Promise<ParentDirectoryDTO> {
    return super.getParentDirFromId(connection, dir);
  }
}

describe('CoverManager', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;
  /**
   * dir
   * |-> subDir
   *     |- pFaceLess
   *     |- v
   *     |- p
   *     |- p2
   * |-> subDir2
   *     |- p4
   */

  let dir: ParentDirectoryDTO;
  let subDir: SubDirectoryDTO;
  let subDir2: SubDirectoryDTO;
  let v: VideoDTO;
  let p: PhotoDTO;
  let p2: PhotoDTO;
  let pFaceLess: PhotoDTO;
  let p4: PhotoDTO;


  const setUpTestGallery = async (): Promise<void> => {
    const directory: ParentDirectoryDTO = TestHelper.getDirectoryEntry(null, 'éűáúőóüöÉŰÚŐÓÜÖ[]^[[]]][asd]');
    subDir = TestHelper.getDirectoryEntry(directory, 'The Phantom Menace');
    subDir2 = TestHelper.getDirectoryEntry(directory, 'Return of the Jedi');
    p = TestHelper.getPhotoEntry1(subDir);
    p.metadata.rating = 4;
    p.metadata.creationDate = 10000;
    p2 = TestHelper.getPhotoEntry2(subDir);
    p2.metadata.rating = 4;
    p2.metadata.creationDate = 20000;
    v = TestHelper.getVideoEntry1(subDir);
    v.metadata.creationDate = 500;
    const pFaceLessTmp = TestHelper.getPhotoEntry3(subDir);
    pFaceLessTmp.metadata.rating = 0;
    pFaceLessTmp.metadata.creationDate = 400000;
    delete pFaceLessTmp.metadata.faces;
    p4 = TestHelper.getPhotoEntry4(subDir2);
    p4.metadata.rating = 5;
    p4.metadata.creationDate = 100;

    dir = await DBTestHelper.persistTestDir(directory);

    subDir = dir.directories[0];
    subDir2 = dir.directories[1];
    p = (subDir.media.filter(m => m.name === p.name)[0] as any);
    p.directory = subDir;
    p2 = (subDir.media.filter(m => m.name === p2.name)[0] as any);
    p2.directory = subDir;
    v = (subDir.media.filter(m => m.name === v.name)[0] as any);
    v.directory = subDir;
    pFaceLess = (subDir.media.filter(m => m.name === pFaceLessTmp.name)[0] as any);
    pFaceLess.directory = subDir;
    p4 = (subDir2.media[0] as any);
    p4.directory = subDir2;
  };

  const setUpSqlDB = async () => {
    await sqlHelper.initDB();
    await setUpTestGallery();
    await ObjectManagers.getInstance().init();
  };


  before(async () => {
    await setUpSqlDB();
    Config.Gallery.ignoreTimestampOffset = false;
  });


  const previewifyMedia = <T extends FileDTO | PhotoDTO>(m: T): T => {
    const tmpDir: DirectoryBaseDTO = m.directory as DirectoryBaseDTO;
    const tmpM = tmpDir.media;
    const tmpD = tmpDir.directories;
    const tmpP = tmpDir.cover;
    const tmpMT = tmpDir.metaFile;
    delete tmpDir.directories;
    delete tmpDir.media;
    delete tmpDir.cover;
    delete tmpDir.validCover;
    delete tmpDir.metaFile;
    const ret = Utils.clone(m);
    delete (ret.directory as DirectoryBaseDTO).id;
    delete (ret.directory as DirectoryBaseDTO).lastScanned;
    delete (ret.directory as DirectoryBaseDTO).lastModified;
    delete (ret.directory as DirectoryBaseDTO).mediaCount;
    delete (ret.directory as DirectoryBaseDTO).youngestMedia;
    delete (ret.directory as DirectoryBaseDTO).oldestMedia;
    delete (ret as PhotoDTO).metadata;
    tmpDir.directories = tmpD;
    tmpDir.media = tmpM;
    tmpDir.cover = tmpP;
    tmpDir.metaFile = tmpMT;
    return ret;
  };


  after(async () => {
    await sqlHelper.clearDB();
  });

  afterEach(() => {
    Config.AlbumCover.SearchQuery = null;
    Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Rating, false),
      new ClientSortingConfig(SortByTypes.Date, false)];
  });


  it('should list directories without cover', async () => {
    const pm = new CoverManager();
    const partialDir = (d: DirectoryBaseDTO) => {
      return {id: d.id, name: d.name, path: d.path};
    };
    expect(await pm.getPartialDirsWithoutCovers()).to.deep.equalInAnyOrder([partialDir(dir)]);
    const conn = await SQLConnection.getConnection();

    await conn.createQueryBuilder()
        .update(DirectoryEntity).set({validCover: false}).execute();

    expect(await pm.getPartialDirsWithoutCovers()).to.deep.equalInAnyOrder([dir, subDir, subDir2].map(d => partialDir(d)));
  });

  it('should sort directory cover', async () => {
    const pm = new CoverManager();
    Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Rating, false),
      new ClientSortingConfig(SortByTypes.Date, false)];
    expect(Utils.clone(await pm.setAndGetCoverForDirectory(subDir))).to.deep.equalInAnyOrder(previewifyMedia(p2));
    Config.AlbumCover.Sorting = [
      new ClientSortingConfig(SortByTypes.Date, false)];
    expect(Utils.clone(await pm.setAndGetCoverForDirectory(subDir))).to.deep.equalInAnyOrder(previewifyMedia(pFaceLess));
    Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Rating, false)];
    expect(Utils.clone(await pm.setAndGetCoverForDirectory(dir))).to.deep.equalInAnyOrder(previewifyMedia(p4));
    Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Name, false)];
    expect(Utils.clone(await pm.setAndGetCoverForDirectory(dir))).to.deep.equalInAnyOrder(previewifyMedia(v));
  });

  it('should get cover for directory', async () => {
    const pm = new CoverManager();

    Config.AlbumCover.SearchQuery = {type: SearchQueryTypes.any_text, text: 'Boba'} as TextSearch;
    expect(Utils.clone(await pm.setAndGetCoverForDirectory(subDir))).to.deep.equalInAnyOrder(previewifyMedia(p));
    Config.AlbumCover.SearchQuery = {type: SearchQueryTypes.any_text, text: 'Derem'} as TextSearch;
    expect(Utils.clone(await pm.setAndGetCoverForDirectory(subDir))).to.deep.equalInAnyOrder(previewifyMedia(p2));
    expect(Utils.clone(await pm.setAndGetCoverForDirectory(dir))).to.deep.equalInAnyOrder(previewifyMedia(p2));
    expect(Utils.clone(await pm.setAndGetCoverForDirectory(subDir2))).to.deep.equalInAnyOrder(previewifyMedia(p4));

  });

  it('should get cover for saved search', async () => {
    const pm = new CoverManager();
    Config.AlbumCover.SearchQuery = null;
    expect(Utils.clone(await pm.getCoverForAlbum({
      searchQuery: {
        type: SearchQueryTypes.any_text,
        text: 'sw'
      } as TextSearch
    }))).to.deep.equalInAnyOrder(previewifyMedia(p4));
    Config.AlbumCover.SearchQuery = {type: SearchQueryTypes.any_text, text: 'Boba'} as TextSearch;
    expect(Utils.clone(await pm.getCoverForAlbum({
      searchQuery: {
        type: SearchQueryTypes.any_text,
        text: 'sw'
      } as TextSearch
    }))).to.deep.equalInAnyOrder(previewifyMedia(p));
    Config.AlbumCover.SearchQuery = {type: SearchQueryTypes.any_text, text: 'Derem'} as TextSearch;
    expect(Utils.clone(await pm.getCoverForAlbum({
      searchQuery: {
        type: SearchQueryTypes.any_text,
        text: 'sw'
      } as TextSearch
    }))).to.deep.equalInAnyOrder(previewifyMedia(p2));
    // Having a preview search query that does not return valid result
    Config.AlbumCover.SearchQuery = {type: SearchQueryTypes.any_text, text: 'wont find it'} as TextSearch;
    expect(Utils.clone(await pm.getCoverForAlbum({
      searchQuery: {
        type: SearchQueryTypes.any_text,
        text: 'Derem'
      } as TextSearch
    }))).to.deep.equalInAnyOrder(previewifyMedia(p2));
    // having a saved search that does not have any image
    Config.AlbumCover.SearchQuery = {type: SearchQueryTypes.any_text, text: 'Derem'} as TextSearch;
    expect(Utils.clone(await pm.getCoverForAlbum({
      searchQuery: {
        type: SearchQueryTypes.any_text,
        text: 'wont find it'
      } as TextSearch
    }))).to.deep.equal(null);
  });

  it('should invalidate and update cover', async () => {
    const gm = new GalleryManagerTest();
    const pm = new CoverManager();
    const conn = await SQLConnection.getConnection();

    const selectDir = async () => {
      return await conn.getRepository(DirectoryEntity).findOne({
        where: {id: subDir.id},
        join: {
          alias: 'dir',
          leftJoinAndSelect: {cover: 'dir.cover'}
        }
      });
    };


    let subdir = await selectDir();

    expect(subdir.validCover).to.equal(true);
    expect(subdir.cover.id).to.equal(p2.id);

    // new version should invalidate
    await pm.onNewDataVersion(subDir as ParentDirectoryDTO);
    subdir = await selectDir();
    expect(subdir.validCover).to.equal(false);
    // during invalidation, we do not remove the previous cover (it's good to show at least some photo)
    expect(subdir.cover.id).to.equal(p2.id);

    await conn.createQueryBuilder()
        .update(DirectoryEntity)
        .set({validCover: false, cover: null}).execute();
    expect((await selectDir()).cover).to.equal(null);


    const res = await gm.getParentDirFromId(conn,
        (await gm.getDirIdAndTime(conn, dir.name, dir.path)).id);
    subdir = await selectDir();
    expect(subdir.validCover).to.equal(true);
    expect(subdir.cover.id).to.equal(p2.id);

  });

});
