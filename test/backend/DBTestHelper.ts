import {Config} from '../../src/common/config/private/Config';
import * as path from 'path';
import * as fs from 'fs';
import {SQLConnection} from '../../src/backend/model/database/SQLConnection';
import {DatabaseType} from '../../src/common/config/private/PrivateConfig';
import {ProjectPath} from '../../src/backend/ProjectPath';
import {DirectoryBaseDTO, ParentDirectoryDTO, SubDirectoryDTO} from '../../src/common/entities/DirectoryDTO';
import {ObjectManagers} from '../../src/backend/model/ObjectManagers';
import {DiskManager} from '../../src/backend/model/fileaccess/DiskManager';
import {IndexingManager} from '../../src/backend/model/database/IndexingManager';
import {GalleryManager} from '../../src/backend/model/database/GalleryManager';
import {Connection} from 'typeorm';
import {Utils} from '../../src/common/Utils';
import {TestHelper} from '../TestHelper';
import {VideoDTO} from '../../src/common/entities/VideoDTO';
import {PhotoDTO} from '../../src/common/entities/PhotoDTO';
import {Logger} from '../../src/backend/Logger';
import {SessionUser, SessionContext} from '../../src/backend/model/SessionContext';
import {SessionManager} from '../../src/backend/model/database/SessionManager';
import {DirectoryEntity} from '../../src/backend/model/database/enitites/DirectoryEntity';
import {MediaEntity} from '../../src/backend/model/database/enitites/MediaEntity';
import {ProjectedDirectoryCacheEntity} from '../../src/backend/model/database/enitites/ProjectedDirectoryCacheEntity';
import {VersionEntity} from '../../src/backend/model/database/enitites/VersionEntity';

declare let describe: any;
const savedDescribe = describe;

class IndexingManagerTest extends IndexingManager {

  public async saveToDB(scannedDirectory: ParentDirectoryDTO): Promise<void> {
    return super.saveToDB(scannedDirectory);
  }
}

class GalleryManagerTest extends GalleryManager {

  public async getDirIdAndTime(connection: Connection, directoryName: string, directoryParent: string) {
    return super.getDirIdAndTime(connection, directoryName, directoryParent);
  }

  public async getParentDirFromId(connection: Connection, session: SessionContext, dir: number): Promise<ParentDirectoryDTO> {
    return super.getParentDirFromId(connection, session, dir);
  }

}

const LOG_TAG = '[DBTestHelper]';

export class DBTestHelper {

  private static mysqlSchemeBuilt = false;
  static enable = {
    sqlite: process.env.TEST_SQLITE !== 'false',
    mysql: process.env.TEST_MYSQL !== 'false'
  };
  public static readonly savedDescribe = savedDescribe;
  public readonly testGalleyEntities: {
    dir: ParentDirectoryDTO,
    subDir: SubDirectoryDTO,
    subDir2: SubDirectoryDTO,
    v: VideoDTO,
    p: PhotoDTO,
    p2: PhotoDTO,
    p3: PhotoDTO,
    p4: PhotoDTO
  } = {
    /**
     * dir
     * |- v
     * |- p
     * |- p2
     * |-> subDir
     *     |- p3
     * |-> subDir2
     *     |- p4
     */

    dir: null,
    subDir: null,
    subDir2: null,
    v: null,
    p: null,
    p2: null,
    p3: null,
    p4: null
  };

  public static get defaultSession(): SessionContext {
    const session = new SessionContext();
    session.user = {projectionKey: SessionManager.NO_PROJECTION_KEY} as SessionUser;
    return session;
  }

  constructor(public dbType: DatabaseType) {
  }

  static describe(settingsOverride: {
    sqlite?: boolean;
    mysql?: boolean;
  } = {}): (name: string, tests: (helper?: DBTestHelper) => void) => void {
    const settings = Utils.clone(DBTestHelper.enable);
    for (const key of Object.keys(settingsOverride)) {
      (settings as any)[key] = (settingsOverride as any)[key];
    }
    return (name: string, tests: (helper?: DBTestHelper) => void) => {
      savedDescribe(name, async () => {
        if (settings.sqlite) {
          const helper = new DBTestHelper(DatabaseType.sqlite);
          savedDescribe('sqlite', () => {
            return tests(helper);
          });
        }
        if (settings.mysql) {
          const helper = new DBTestHelper(DatabaseType.mysql);
          savedDescribe('mysql', function(): void {
            this.timeout(99999999); // hint for the test environment
            return tests(helper);
          });
        }
      });
    };
  }

  public static async persistTestDir(directory: DirectoryBaseDTO): Promise<ParentDirectoryDTO> {
    const OMInited = ObjectManagers.isReady();
    if (!OMInited) {
      await ObjectManagers.getInstance().init();
    }
    const connection = await SQLConnection.getConnection();
    ObjectManagers.getInstance().IndexingManager.indexDirectory = () => Promise.resolve(null);


    await ObjectManagers.getInstance().IndexingManager.saveToDB(directory as ParentDirectoryDTO);
    // not saving subdirs. saveToDB destroys data
    // await im.saveToDB(subDir);
    // await im.saveToDB(subDir2);

    if (ObjectManagers.getInstance().IndexingManager &&
      ObjectManagers.getInstance().IndexingManager.IsSavingInProgress) {
      await ObjectManagers.getInstance().IndexingManager.SavingReady;
    }

    const gm = new GalleryManagerTest();

    const dir = await gm.getParentDirFromId(connection, this.defaultSession,
      (await gm.getDirIdAndTime(connection, directory.name, path.join(directory.path, path.sep))).id);

    const populateDir = async (d: DirectoryBaseDTO) => {
      for (let i = 0; i < d.directories.length; i++) {
        d.directories[i] = await gm.getParentDirFromId(connection, this.defaultSession,
          (await gm.getDirIdAndTime(connection, d.directories[i].name,
            path.join(DiskManager.pathFromParent(d), path.sep))).id);
        await populateDir(d.directories[i]);
      }
    };
    await populateDir(dir);
    if (!OMInited) {
      await ObjectManagers.reset();
    }
    return dir;
  }

  public initDB = async (): Promise<void> => {
    Config.Extensions.enabled = false; // make all tests clean
    if (typeof this.dbType === 'undefined') {
      throw new Error('dbType is undefined');
    }
    if (this.dbType === DatabaseType.sqlite) {
      await this.initSQLite();
    } else if (this.dbType === DatabaseType.mysql) {
      await this.initMySQL();
    }
  };

  public clearDB = async (): Promise<void> => {
    if (typeof this.dbType === 'undefined') {
      throw new Error('dbType is undefined');
    }
    if (this.dbType === DatabaseType.sqlite) {
      await this.clearUpSQLite();
    } else if (this.dbType === DatabaseType.mysql) {
      await this.clearUpMysql();
    }
  };

  public setUpTestGallery = async (): Promise<void> => {
    const directory: ParentDirectoryDTO = TestHelper.getDirectoryEntry(null, '.');
    this.testGalleyEntities.subDir = TestHelper.getDirectoryEntry(directory, 'The Phantom Menace');
    this.testGalleyEntities.subDir2 = TestHelper.getDirectoryEntry(directory, 'Return of the Jedi');
    this.testGalleyEntities.p = TestHelper.getRandomizedPhotoEntry(directory, 'Photo1');
    this.testGalleyEntities.p2 = TestHelper.getRandomizedPhotoEntry(directory, 'Photo2');
    this.testGalleyEntities.p3 = TestHelper.getRandomizedPhotoEntry(this.testGalleyEntities.subDir, 'Photo3');
    this.testGalleyEntities.p4 = TestHelper.getRandomizedPhotoEntry(this.testGalleyEntities.subDir2, 'Photo4');
    this.testGalleyEntities.v = TestHelper.getVideoEntry1(directory);

    this.testGalleyEntities.dir = await DBTestHelper.persistTestDir(directory);
    this.testGalleyEntities.subDir = this.testGalleyEntities.dir.directories[0];
    this.testGalleyEntities.subDir2 = this.testGalleyEntities.dir.directories[1];
    this.testGalleyEntities.p = (this.testGalleyEntities.dir.media.filter(m => m.name === this.testGalleyEntities.p.name)[0] as any);
    this.testGalleyEntities.p.directory = this.testGalleyEntities.dir;
    this.testGalleyEntities.p2 = (this.testGalleyEntities.dir.media.filter(m => m.name === this.testGalleyEntities.p2.name)[0] as any);
    this.testGalleyEntities.p2.directory = this.testGalleyEntities.dir;
    this.testGalleyEntities.v = (this.testGalleyEntities.dir.media.filter(m => m.name === this.testGalleyEntities.v.name)[0] as any);
    this.testGalleyEntities.v.directory = this.testGalleyEntities.dir;
    this.testGalleyEntities.p3 = (this.testGalleyEntities.dir.directories[0].media[0] as any);
    this.testGalleyEntities.p3.directory = this.testGalleyEntities.dir.directories[0];
    this.testGalleyEntities.p4 = (this.testGalleyEntities.dir.directories[1].media[0] as any);
    this.testGalleyEntities.p2.directory = this.testGalleyEntities.dir.directories[1];
  };

  /**
   * Gallery with nested directories, each photo name starts with the given prefix:
   * ./ (rootPhoto)
   *  public/ (publicPhoto, publicTrack.gpx)
   *    sub/ (subPhoto)
   *  private/ (privatePhoto)
   *    deep/ (deepPhoto)
   *  other/ (otherPhoto)
   */
  public setUpNestedTestGallery = async (): Promise<void> => {
    const root = TestHelper.getDirectoryEntry(null, '.');
    const pub = TestHelper.getDirectoryEntry(root, 'public');
    const sub = TestHelper.getDirectoryEntry(pub, 'sub');
    const priv = TestHelper.getDirectoryEntry(root, 'private');
    const deep = TestHelper.getDirectoryEntry(priv, 'deep');
    const other = TestHelper.getDirectoryEntry(root, 'other');
    TestHelper.getRandomizedPhotoEntry(root, 'rootPhoto');
    TestHelper.getRandomizedPhotoEntry(pub, 'publicPhoto');
    TestHelper.getRandomizedGPXEntry(pub, 'publicTrack');
    TestHelper.getRandomizedPhotoEntry(sub, 'subPhoto');
    TestHelper.getRandomizedPhotoEntry(priv, 'privatePhoto');
    TestHelper.getRandomizedPhotoEntry(deep, 'deepPhoto');
    TestHelper.getRandomizedPhotoEntry(other, 'otherPhoto');
    await DBTestHelper.persistTestDir(root);
    // grandchildren are only saved with their parents
    await ObjectManagers.getInstance().IndexingManager.saveToDB(pub as ParentDirectoryDTO);
    await ObjectManagers.getInstance().IndexingManager.saveToDB(priv as ParentDirectoryDTO);
  };

  public static async printDB() {
    const conn = await SQLConnection.getConnection();
    const dirs = await conn.getRepository(DirectoryEntity).createQueryBuilder('dir').getMany();
    const dCache = await conn.getRepository(ProjectedDirectoryCacheEntity).createQueryBuilder('c').leftJoinAndSelect('c.cover', 'cover').getMany();
    const media = await conn.getRepository(MediaEntity).createQueryBuilder('m').getMany();

    return JSON.stringify({dirs, dCache, media}, null, 2);
  }

  private async initMySQL(): Promise<void> {
    await this.resetMySQL();
  }


  private async resetMySQL(): Promise<void> {
    Logger.debug(LOG_TAG, 'resetting up mysql');
    await this.clearUpMysql();
    await ObjectManagers.getInstance().init();
  }

  private async clearUpMysql(): Promise<void> {
    Logger.debug(LOG_TAG, 'clearing up mysql');
    Config.Database.type = DatabaseType.mysql;
    Config.Database.mysql.database = 'pigallery2_test';
    // reset first: it waits for background saves that would otherwise hit the dropped tables
    await ObjectManagers.reset();
    const conn = await SQLConnection.getConnection();
    // Rebuilding the scheme is slow on MySQL, so do it only once per run (to pick up entity changes)
    // and only empty the tables afterward. Keeping the version row skips the rebuild in schemeSync.
    if (!DBTestHelper.mysqlSchemeBuilt || !(await DBTestHelper.truncateMysql(conn))) {
      await conn.dropDatabase();
      DBTestHelper.mysqlSchemeBuilt = true;
    }
    await SQLConnection.close();
    await fs.promises.rm(TestHelper.TMP_DIR, {recursive: true, force: true});
  }

  /**
   * Empties every table except the version and resets the ids, like a fresh DB.
   * DELETE + resetting AUTO_INCREMENT is several times faster than TRUNCATE on InnoDB.
   * Returns false if it failed (e.g. a test dropped some tables).
   */
  private static async truncateMysql(conn: Connection): Promise<boolean> {
    const versionTable = conn.getMetadata(VersionEntity).tableName;
    const tables = new Set(conn.entityMetadatas.map(m => m.tableName));
    tables.delete(versionTable);
    const qr = conn.createQueryRunner();
    try {
      await qr.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of tables) {
        await qr.query('DELETE FROM `' + table + '`');
        await qr.query('ALTER TABLE `' + table + '` AUTO_INCREMENT = 1');
      }
      return true;
    } catch (e) {
      Logger.debug(LOG_TAG, 'Could not truncate mysql tables, dropping the db', e);
      return false;
    } finally {
      await qr.query('SET FOREIGN_KEY_CHECKS = 1');
      await qr.release();
    }
  }

  private async initSQLite(): Promise<void> {
    await this.resetSQLite();
  }

  private async resetSQLite(): Promise<void> {
    Logger.debug(LOG_TAG, 'resetting sqlite');
    await this.clearUpSQLite();
    await ObjectManagers.getInstance().init();
  }

  private async clearUpSQLite(): Promise<void> {
    Logger.debug(LOG_TAG, 'clearing up sqlite');
    Config.Database.type = DatabaseType.sqlite;
    Config.Database.dbFolder = TestHelper.TMP_DIR;
    ProjectPath.reset();
    await ObjectManagers.reset();
    await fs.promises.rm(TestHelper.TMP_DIR, {recursive: true, force: true});
  }

}
