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

  public async getParentDirFromId(connection: Connection, dir: number): Promise<ParentDirectoryDTO> {
    return super.getParentDirFromId(connection, dir);
  }

}

const LOG_TAG = 'DBTestHelper';

export class DBTestHelper {

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
    await ObjectManagers.getInstance().init();
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

    const dir = await gm.getParentDirFromId(connection,
        (await gm.getDirIdAndTime(connection, directory.name, path.join(directory.path, path.sep))).id);

    const populateDir = async (d: DirectoryBaseDTO) => {
      for (let i = 0; i < d.directories.length; i++) {
        d.directories[i] = await gm.getParentDirFromId(connection,
            (await gm.getDirIdAndTime(connection, d.directories[i].name,
                path.join(DiskManager.pathFromParent(d), path.sep))).id);
        await populateDir(d.directories[i]);
      }
    };
    await populateDir(dir);

    await ObjectManagers.reset();
    return dir;
  }

  public async initDB(): Promise<void> {
    await Config.load();
    Config.Extensions.enabled = false; // make all tests clean
    if (this.dbType === DatabaseType.sqlite) {
      await this.initSQLite();
    } else if (this.dbType === DatabaseType.mysql) {
      await this.initMySQL();
    }
  }

  public async clearDB(): Promise<void> {
    if (this.dbType === DatabaseType.sqlite) {
      await this.clearUpSQLite();
    } else if (this.dbType === DatabaseType.mysql) {
      await this.clearUpMysql();
    }
  }

  public async setUpTestGallery(): Promise<void> {
    const directory: ParentDirectoryDTO = TestHelper.getDirectoryEntry();
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
  }

  private async initMySQL(): Promise<void> {
    await this.resetMySQL();
  }

  private async resetMySQL(): Promise<void> {
    Logger.debug(LOG_TAG, 'resetting up mysql');
    await this.clearUpMysql();
    const conn = await SQLConnection.getConnection();
    await conn.query('CREATE DATABASE IF NOT EXISTS ' + conn.options.database);
    await SQLConnection.close();
    await ObjectManagers.getInstance().init();
  }

  private async clearUpMysql(): Promise<void> {
    Logger.debug(LOG_TAG, 'clearing up mysql');
    await ObjectManagers.reset();
    Config.Database.type = DatabaseType.mysql;
    Config.Database.mysql.database = 'pigallery2_test';
    await fs.promises.rm(TestHelper.TMP_DIR, {recursive: true, force: true});
    const conn = await SQLConnection.getConnection();
    await conn.query('DROP DATABASE IF EXISTS ' + conn.options.database);
    await SQLConnection.close();
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
