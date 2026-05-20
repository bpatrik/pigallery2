import * as fs from 'fs';
import {Config} from '../../../../../src/common/config/private/Config';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {GalleryManager} from '../../../../../src/backend/model/database/GalleryManager';
import {DirectoryBaseDTO, DirectoryDTOUtils, ParentDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {TestHelper} from '../../../../TestHelper';
import {Connection} from 'typeorm';
import {Utils} from '../../../../../src/common/Utils';
import {MediaDTO} from '../../../../../src/common/entities/MediaDTO';
import {FileDTO} from '../../../../../src/common/entities/FileDTO';
import {IndexingManager} from '../../../../../src/backend/model/database/IndexingManager';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {DBTestHelper} from '../../../DBTestHelper';
import {ReIndexingSensitivity} from '../../../../../src/common/config/private/PrivateConfig';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../src/common/entities/SearchQueryDTO';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import * as path from 'path';
import {AlbumManager} from '../../../../../src/backend/model/database/AlbumManager';
import {SortByTypes} from '../../../../../src/common/entities/SortingMethods';
import {ClientSortingConfig} from '../../../../../src/common/config/public/ClientConfig';
import {DiskManager} from '../../../../../src/backend/model/fileaccess/DiskManager';
import {SessionContext} from '../../../../../src/backend/model/SessionContext';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deepEqualInAnyOrder = require('deep-equal-in-any-order');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chai = require('chai');

chai.use(deepEqualInAnyOrder);
const {expect} = chai;

class GalleryManagerTest extends GalleryManager {

  public async getDirIdAndTime(connection: Connection, directoryName: string, directoryParent: string) {
    return super.getDirIdAndTime(connection, directoryName, directoryParent);
  }

  public async getParentDirFromId(connection: Connection, session: SessionContext, dir: number): Promise<ParentDirectoryDTO> {
    return super.getParentDirFromId(connection, session, dir);
  }
}

class IndexingManagerTest extends IndexingManager {


  public async queueForSave(scannedDirectory: ParentDirectoryDTO): Promise<void> {
    return super.queueForSave(scannedDirectory);
  }

  public async saveToDB(scannedDirectory: ParentDirectoryDTO): Promise<void> {
    return await super.saveToDB(scannedDirectory);
  }
}

// to help WebStorm to handle the test cases
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let describe: any;
declare const after: any;
declare const it: any;
// eslint-disable-next-line prefer-const
describe = DBTestHelper.describe();

describe('IndexingManager', (sqlHelper: DBTestHelper) => {


  beforeEach(async () => {
    Config.loadSync();
    Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Rating, false)];
    await sqlHelper.initDB();
  });


  afterEach(async () => {
    await sqlHelper.clearDB();
  });
  after(() => {
      Config.loadSync();
    }
  );

  const setPartial = (dir: DirectoryBaseDTO) => {
    if (!dir.cache.cover && dir.media && dir.media.length > 0) {
      dir.cache.cover = dir.media[0];
    }
    dir.isPartial = true;
    delete dir.directories;
    delete dir.metaFile;
    delete dir.media;
  };

  const makePreview = (m: MediaDTO) => {
    delete (m.directory as ParentDirectoryDTO)?.id;
    delete m.metadata;
    return m;
  };


  const indexifyReturn = (dir: DirectoryBaseDTO): DirectoryBaseDTO => {
    const d = Utils.clone(dir);

    if (d.cache.cover) {
      delete d.cache.cover.metadata;
    }
    if (d.directories) {
      for (const subD of d.directories) {
        if (subD.cache.cover) {
          delete subD.cache.cover.metadata;
        }
      }
    }

    return d;
  };

  const removeIds = (dir: DirectoryBaseDTO): DirectoryBaseDTO => {
    delete dir.id;
    dir.media.forEach((media: MediaDTO) => {
      delete media.id;
    });
    if (dir.cache) {
      delete dir.cache.id;
    }
    if (dir.cache.cover) {
      delete dir.cache.cover.id;
    }
    if (dir.cache.directory) {
      delete dir.cache.directory.id;
    }
    if (dir.metaFile) {
      if (dir.metaFile.length === 0) {
        delete dir.metaFile;
      } else {
        dir.metaFile.forEach((file: FileDTO) => {
          delete file.id;
        });
      }
    }
    if (dir.directories) {
      dir.directories.forEach((directory: DirectoryBaseDTO) => {
        removeIds(directory);
      });
    }

    return dir;
  };

  it('should support case sensitive file names', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry();
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1', 2, 3);
    const p2 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo2', 2, 2);
    p1.name = 'test.jpg';
    p2.name = 'Test.jpg';

    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();
    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);

    expect(Utils.clone(Utils.removeNullOrEmptyObj(removeIds(selected))))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));
  });


  it('should stop indexing on empty folder', async () => {
    const gm = new GalleryManagerTest();
    const session = DBTestHelper.defaultSession;

    ProjectPath.reset();
    ProjectPath.ImageFolder = path.join(__dirname, '/../../../assets');

    await ObjectManagers.getInstance().IndexingManager.indexDirectory('.');
    if (ObjectManagers.getInstance().IndexingManager.IsSavingInProgress) {
      await ObjectManagers.getInstance().IndexingManager.SavingReady;
    }

    const directoryPath = GalleryManager.parseRelativeDirPath(
      '.'
    );
    const conn = await SQLConnection.getConnection();
    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, directoryPath.name, directoryPath.parent)).id);


    expect(selected?.media?.length)
      .to.be.greaterThan(0);
    if (!fs.existsSync(TestHelper.TMP_DIR)) {
      fs.mkdirSync(TestHelper.TMP_DIR);
    }
    const tmpDir = path.join(TestHelper.TMP_DIR, '/rnd5sdf_emptyDir');
    fs.mkdirSync(tmpDir);
    ProjectPath.ImageFolder = tmpDir;
    let notFailed = false;
    try {
      await ObjectManagers.getInstance().IndexingManager.indexDirectory('.');
      notFailed = true;
    } catch (e) {
      // it expected to fail
    }
    if (notFailed) {
      expect(true).to.equal(false, 'indexDirectory is expected to fail');
    }

  });


  it('should support case sensitive directory', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry(null, 'parent');
    const subDir1 = TestHelper.getRandomizedDirectoryEntry(parent, 'subDir');
    const p1 = TestHelper.getRandomizedPhotoEntry(subDir1, 'subPhoto1', 0, 5);
    const subDir2 = TestHelper.getRandomizedDirectoryEntry(parent, 'SUBDIR');
    const p2 = TestHelper.getRandomizedPhotoEntry(subDir2, 'subPhoto2', 0, 3);


    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();

    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);
    removeIds(selected);
    setPartial(subDir1);
    setPartial(subDir2);
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));
  });

  it('should support case sensitive directory path', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent1 = TestHelper.getRandomizedDirectoryEntry(null, 'parent');
    const parent2 = TestHelper.getRandomizedDirectoryEntry(null, 'PARENT');
    const subDir1 = TestHelper.getRandomizedDirectoryEntry(parent1, 'subDir');
    const p1 = TestHelper.getRandomizedPhotoEntry(subDir1, 'subPhoto1', 0);
    const subDir2 = TestHelper.getRandomizedDirectoryEntry(parent2, 'subDir2');
    const p2 = TestHelper.getRandomizedPhotoEntry(subDir2, 'subPhoto2', 0);


    DirectoryDTOUtils.removeReferences(parent1);
    await im.saveToDB(Utils.clone(parent1) as ParentDirectoryDTO);
    DirectoryDTOUtils.removeReferences(parent2);
    await im.saveToDB(Utils.clone(parent2) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();
    {
      const selected = await gm.getParentDirFromId(conn, session,
        (await gm.getDirIdAndTime(conn, parent1.name, parent1.path)).id);

      DirectoryDTOUtils.removeReferences(selected);
      removeIds(selected);
      setPartial(subDir1);
      expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
        .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent1)));
    }
    {
      const selected = await gm.getParentDirFromId(conn, session,
        (await gm.getDirIdAndTime(conn, parent2.name, parent2.path)).id);

      DirectoryDTOUtils.removeReferences(selected);
      removeIds(selected);
      setPartial(subDir2);
      expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
        .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent2)));
    }
  });

  it('should support emoji in names', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry(null, 'parent dir 😀');
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1');
    p1.name = 'test 😀.jpg';

    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();

    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);

    expect(Utils.clone(Utils.removeNullOrEmptyObj(removeIds(selected))))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));
  });


  it('should select cover', async () => {
    const selectDirectory = async (gmTest: GalleryManagerTest, dir: DirectoryBaseDTO): Promise<ParentDirectoryDTO> => {
      const conn = await SQLConnection.getConnection();
      const session = DBTestHelper.defaultSession;
      const selected = await gmTest.getParentDirFromId(conn, session,
        (await gmTest.getDirIdAndTime(conn, dir.name, dir.path)).id);

      DirectoryDTOUtils.removeReferences(selected);
      removeIds(selected);
      return selected;
    };

    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();


    const parent = TestHelper.getRandomizedDirectoryEntry(null, 'parent');


    const checkParent = async () => {
      const selected = await selectDirectory(gm, parent);
      const cloned = Utils.removeNullOrEmptyObj(indexifyReturn(parent));
      if (cloned.directories) {
        cloned.directories.forEach(d => setPartial(d));
      }
      expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
        .to.deep.equalInAnyOrder(cloned);
    };

    const saveToDBAndCheck = async (dir: DirectoryBaseDTO) => {
      DirectoryDTOUtils.removeReferences(parent);
      await im.saveToDB(Utils.clone(dir) as ParentDirectoryDTO);
      await checkParent();
      DirectoryDTOUtils.addReferences(parent);
    };

    await saveToDBAndCheck(parent);

    const subDir1 = TestHelper.getRandomizedDirectoryEntry(parent, 'subDir');
    await saveToDBAndCheck(parent);

    const p1 = TestHelper.getRandomizedPhotoEntry(subDir1, 'subPhoto1', 0, 3);
    await saveToDBAndCheck(subDir1);

    const subDir2 = TestHelper.getRandomizedDirectoryEntry(parent, 'subDir2');
    await saveToDBAndCheck(parent);

    const p2 = TestHelper.getRandomizedPhotoEntry(subDir2, 'subPhoto2', 0, 2);
    await saveToDBAndCheck(subDir2);

    const p = TestHelper.getRandomizedPhotoEntry(parent, 'photo', 0, 5);
    await saveToDBAndCheck(parent);


  });


  it('should be able to save parent after child', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry(null, 'parentDir');
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1',2,2);

    const subDir = TestHelper.getRandomizedDirectoryEntry(null, 'subDir');
    subDir.path = DiskManager.pathFromParent(parent);
    const sp1 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto1', 0,5);
    const sp2 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto2', 0,3);
    Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Rating, false)];

    DirectoryDTOUtils.removeReferences(subDir);
    await im.saveToDB(Utils.clone(subDir) as ParentDirectoryDTO);

    parent.directories.push(subDir);
    TestHelper.updateDirCache(parent);


    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();

    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);
    removeIds(selected);
    setPartial(subDir);
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));
  });


  it('should save root parent after child', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry(null, '.');
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1');

    const subDir = TestHelper.getRandomizedDirectoryEntry(null, 'subDir');
    subDir.path = DiskManager.pathFromParent(parent);
    const sp1 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto1', 0);
    sp1.metadata.rating = 5;
    const sp2 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto2', 0);
    sp2.metadata.rating = 3;
    Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Rating, false)];


    DirectoryDTOUtils.removeReferences(subDir);
    await im.saveToDB(Utils.clone(subDir) as ParentDirectoryDTO);

    parent.directories.push(subDir);
    TestHelper.updateDirCache(parent);


    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();
    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);
    removeIds(selected);
    setPartial(subDir);
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));
  });

  it('should save parent directory', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry(null, '.');
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1', 2, 4);
    const p2 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo2', 2, 3);
    const gpx = TestHelper.getRandomizedGPXEntry(parent, 'GPX1');
    const subDir = TestHelper.getRandomizedDirectoryEntry(parent, 'subDir');
    const sp1 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto1', 0, 5);
    const sp2 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto2', 0, 3);

    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();
    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);
    removeIds(selected);
    setPartial(subDir);
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)), 'db content:' + await DBTestHelper.printDB());
  });


  it('should save photos with extreme parameters', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry();
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1');
    const p2 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo2');
    const minFloat = parseFloat((1.1 * Math.pow(10, -38)).toFixed(10));
    const maxFloat = parseFloat((3.4 * Math.pow(10, +38)).toFixed(10));
    p1.metadata.cameraData.fStop = minFloat;
    p2.metadata.cameraData.fStop = maxFloat;
    p1.metadata.cameraData.exposure = minFloat;
    p2.metadata.cameraData.exposure = maxFloat;
    p1.metadata.cameraData.focalLength = minFloat;
    p2.metadata.cameraData.focalLength = maxFloat;
    p1.metadata.positionData.GPSData.latitude = maxFloat;
    p2.metadata.positionData.GPSData.latitude = minFloat;
    p1.metadata.positionData.GPSData.longitude = maxFloat;
    p2.metadata.positionData.GPSData.longitude = minFloat;


    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();
    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);
    removeIds(selected);
    delete selected.cache.cover;
    delete parent.cache.cover;
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));
  });

  it('should skip meta files', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry();
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1',2,3);
    const p2 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo2',2,4);
    const gpx = TestHelper.getRandomizedGPXEntry(parent, 'GPX1');
    DirectoryDTOUtils.removeReferences(parent);
    Config.MetaFile.gpx = true;
    Config.MetaFile.markdown = true;
    Config.MetaFile.pg2conf = true;
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    Config.MetaFile.gpx = false;
    Config.MetaFile.markdown = false;
    Config.MetaFile.pg2conf = false;
    const conn = await SQLConnection.getConnection();
    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    delete parent.metaFile;
    DirectoryDTOUtils.removeReferences(selected);
    removeIds(selected);
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));
  });

  it('should update sub directory', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry();
    parent.name = 'parent';
    const p1 = TestHelper.getRandomizedPhotoEntry(parent);
    const subDir = TestHelper.getRandomizedDirectoryEntry(parent, 'subDir');
    subDir.name = 'subDir';
    const sp1 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto1', 5, 5);

    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const sp2 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto2', 2,2 );
    const sp3 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto3', 3,3);

    DirectoryDTOUtils.removeReferences(subDir);
    await im.saveToDB(Utils.clone(subDir) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();
    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, subDir.name, subDir.path)).id);

    // subDir.isPartial = true;
    //  delete subDir.directories;
    DirectoryDTOUtils.removeReferences(selected);
    delete subDir.parent;
    delete subDir.metaFile;
    removeIds(selected);
    // selected.directories[0].parent = selected;
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(subDir)));
  });

  it('should avoid race condition', async () => {
    const conn = await SQLConnection.getConnection();
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;
    Config.MetaFile.gpx = true;
    Config.MetaFile.markdown = true;
    Config.MetaFile.pg2conf = true;
    const parent = TestHelper.getRandomizedDirectoryEntry();
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1',2,2);
    const p2 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo2',2,3);
    const gpx = TestHelper.getRandomizedGPXEntry(parent, 'GPX1');
    const subDir = TestHelper.getRandomizedDirectoryEntry(parent, 'subDir');
    const sp1 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto1', 1,5);
    const sp2 = TestHelper.getRandomizedPhotoEntry(subDir, 'subPhoto2', 1,3);
    Config.AlbumCover.Sorting = [new ClientSortingConfig(SortByTypes.Rating, false)];

    DirectoryDTOUtils.removeReferences(parent);
    const s1 = im.queueForSave(Utils.clone(parent) as ParentDirectoryDTO);
    const s2 = im.queueForSave(Utils.clone(parent) as ParentDirectoryDTO);
    const s3 = im.queueForSave(Utils.clone(parent) as ParentDirectoryDTO);

    await Promise.all([s1, s2, s3]);

    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);
    removeIds(selected);
    setPartial(subDir);
    parent.directories.forEach(d => delete (d.cache?.cover.metadata as any).faces);
    delete sp1.metadata.faces;
    delete sp2.metadata.faces;
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equalInAnyOrder(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));
  });

  it('should reset DB', async () => {
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    const parent = TestHelper.getRandomizedDirectoryEntry();
    const p1 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo1', 2, 3);
    const p2 = TestHelper.getRandomizedPhotoEntry(parent, 'Photo2', 2, 4);

    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);

    const conn = await SQLConnection.getConnection();
    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, parent.name, parent.path)).id);

    DirectoryDTOUtils.removeReferences(selected);
    removeIds(selected);
    expect(Utils.clone(Utils.removeNullOrEmptyObj(selected)))
      .to.deep.equal(Utils.removeNullOrEmptyObj(indexifyReturn(parent)));

    await im.resetDB();
    const selectReset = await gm.getDirIdAndTime(conn, parent.name, parent.path);
    expect(selectReset).to.deep.equal(null);
  });


  (it('should save 1500 photos', async () => {
    const conn = await SQLConnection.getConnection();
    const gm = new GalleryManagerTest();
    const im = new IndexingManagerTest();
    const session = DBTestHelper.defaultSession;

    Config.MetaFile.gpx = true;
    Config.MetaFile.markdown = true;
    Config.MetaFile.pg2conf = true;
    const parent = TestHelper.getRandomizedDirectoryEntry();
    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(Utils.clone(parent) as ParentDirectoryDTO);
    const subDir = TestHelper.getRandomizedDirectoryEntry(parent, 'subDir');
    for (let i = 0; i < 1500; i++) {
      TestHelper.getRandomizedPhotoEntry(subDir, 'p' + i);
    }

    DirectoryDTOUtils.removeReferences(parent);
    await im.saveToDB(subDir as ParentDirectoryDTO);

    const selected = await gm.getParentDirFromId(conn, session,
      (await gm.getDirIdAndTime(conn, subDir.name, subDir.path)).id);
    expect(selected.media.length).to.equal(subDir.media.length);
  }) as any).timeout(40000);

  it('should save .md with date', async () => {
    Config.Album.enabled = true;
    Config.Faces.enabled = true;

    Config.Media.folder = path.join(__dirname, '/../../../assets');
    ProjectPath.ImageFolder = path.join(__dirname, '/../../../assets');
    const im = new IndexingManagerTest();
    const gm = new GalleryManagerTest();
    const session = DBTestHelper.defaultSession;

    const d = await DiskManager.scanDirectory('/');

    await im.saveToDB(d);

    const dir = await gm.listDirectory(session, '/');
    expect(dir.metaFile).to.be.an('array');

    expect(dir.metaFile).to.be.deep.equal([
      {
        date: 1126455782000,
        id: 1,
        name: 'index.md'
      }
    ]);
  });

  DBTestHelper.savedDescribe('Test listDirectory', () => {
    const statSync = fs.statSync;
    let dirTime = 0;
    const indexedTime = {
      lastScanned: 0,
      lastModified: 0
    };

    beforeEach(() => {
      dirTime = 0;

      ObjectManagers.getInstance().IndexingManager = new IndexingManagerTest();
      indexedTime.lastModified = 0;
      indexedTime.lastScanned = 0;
    });

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      fs.statSync = statSync;
    });

    it('with re indexing severity low', async () => {
      Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      fs.statSync = () => ({ctime: new Date(dirTime), mtime: new Date(dirTime)});
      const gm = new GalleryManagerTest();
      const session = DBTestHelper.defaultSession;
      gm.getDirIdAndTime = () => {
        return Promise.resolve(indexedTime as any);
      };
      gm.getParentDirFromId = (): Promise<ParentDirectoryDTO> => {
        return Promise.resolve(indexedTime) as unknown as Promise<ParentDirectoryDTO>;
      };

      ObjectManagers.getInstance().IndexingManager.indexDirectory = (...args) => {
        return Promise.resolve('indexing') as any;
      };

      indexedTime.lastScanned = null;
      expect(await gm.listDirectory(session, './')).to.be.equal('indexing');
      indexedTime.lastModified = 0;
      dirTime = 1;
      expect(await gm.listDirectory(session, './')).to.be.equal('indexing');
      indexedTime.lastScanned = 10;
      indexedTime.lastModified = 1;
      dirTime = 1;
      expect(await gm.listDirectory(session, './')).to.be.equal(indexedTime);
      expect(await gm.listDirectory(session, './', 1, 10))
        .to.be.equal(null);


    });
  });


  DBTestHelper.savedDescribe('indexDirectory(waitForSave)', () => {
    beforeEach(async () => {
      await sqlHelper.initDB();
    });

    afterEach(async () => {
      Config.loadSync();
      await sqlHelper.clearDB();
    });

    it('resolves after the specific directory is saved and does not wait for the whole queue (even with duplicates)', async () => {
      // Ensure ImageFolder is non-empty for the empty-root guard
      Config.Album.enabled = true;
      Config.Faces.enabled = true;
      ProjectPath.reset();
      Config.Media.folder = path.join(__dirname, '/../../../assets');
      ProjectPath.ImageFolder = path.join(__dirname, '/../../../assets');

      const completedSaves: string[] = [];

      class IMWithDelay extends IndexingManager {
        public async saveToDB(scannedDirectory: ParentDirectoryDTO): Promise<void> {
          // mimic original concurrency guard
          (this as any).isSaving = true;
          try {
            if (scannedDirectory.name === 'B') {
              await new Promise((res) => setTimeout(res, 30));
              completedSaves.push('B');
              return;
            }
            if (scannedDirectory.name === 'C') {
              await new Promise((res) => setTimeout(res, 80));
              completedSaves.push('C');
              return;
            }
            await new Promise((res) => setTimeout(res, 10));
            completedSaves.push(scannedDirectory.name);
          } finally {
            (this as any).isSaving = false;
          }
        }
      }

      // Stub DiskManager.scanDirectory to return consistent DTOs
      const originalScan = DiskManager.scanDirectory;
      const makeDir = (name: string): ParentDirectoryDTO => ({
        name,
        path: path.join(path.sep),
        mediaCount: 0,
        lastModified: 1,
        lastScanned: 1,
        youngestMedia: 0,
        oldestMedia: 0,
        directories: [],
        media: [],
        metaFile: []
      } as unknown as ParentDirectoryDTO);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      DiskManager.scanDirectory = async (rel: string): Promise<ParentDirectoryDTO> => makeDir(rel);

      const im = new IMWithDelay();

      try {
        // Queue two saves for the same directory ('B'), then another different directory ('C')
        const pB1 = im.indexDirectory('B', true);
        const pB2 = im.indexDirectory('B', true);
        const pC = im.indexDirectory('C', true); // queued after Bs and slower

        // Wait for first 'B' save only; should not wait for 'C'
        await pB1;
        expect(completedSaves[0]).to.equal('B');
        expect(completedSaves.filter(n => n === 'B').length).to.be.equal(1);
        expect(completedSaves.includes('C')).to.equal(false);

        // Wait for second 'B' save; regardless of dedupe, it should finish before 'C'
        await pB2;
        expect(completedSaves.filter(n => n === 'B').length).to.be.equal(2);
        expect(completedSaves.includes('C')).to.equal(false);

        // Now ensure 'C' completes afterwards
        await pC;
        expect(completedSaves[completedSaves.length - 1]).to.equal('C');
      } finally {
        // restore stubs
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        DiskManager.scanDirectory = originalScan;
        ProjectPath.reset();
      }
    });
  });

  DBTestHelper.savedDescribe('should index .pg2conf', () => {


    it('.saved_searches.pg2conf', async () => {
      Config.Album.enabled = true;
      Config.Faces.enabled = true;

      Config.Media.folder = path.join(__dirname, '/../../../assets');
      ProjectPath.ImageFolder = path.join(__dirname, '/../../../assets');
      const im = new IndexingManagerTest();
      const am = new AlbumManager();

      const dir = await DiskManager.scanDirectory('/');
      const p = Utils.clone(dir.media.find(m => m.name === 'exiftool.jpg')); // .saved_searches.pg2conf should match this file
      p.directory = {
        path: dir.path,
        name: dir.name
      };
      await im.saveToDB(dir);

      const albums = await am.getAll(DBTestHelper.defaultSession);
      expect(albums).to.be.deep.equal([
        {
          id: 1,
          name: 'Alvin',
          locked: true,
          cache: {
            cover: makePreview(Utils.clone(p)),
            id: 1,
            itemCount: 1,
            oldestMedia: p.metadata.creationDate,
            valid: true,
            youngestMedia: p.metadata.creationDate,
          },
          searchQuery: {
            type: SearchQueryTypes.person,
            value: 'Alvin',
            matchType: TextSearchQueryMatchTypes.like
          } as TextSearch
        }
      ]);
    });
  });
});
