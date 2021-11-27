import 'reflect-metadata';
import {Connection, ConnectionOptions, createConnection, getConnection} from 'typeorm';
import {UserEntity} from './enitites/UserEntity';
import {UserRoles} from '../../../../common/entities/UserDTO';
import {PhotoEntity} from './enitites/PhotoEntity';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {Config} from '../../../../common/config/private/Config';
import {SharingEntity} from './enitites/SharingEntity';
import {PasswordHelper} from '../../PasswordHelper';
import {ProjectPath} from '../../../ProjectPath';
import {VersionEntity} from './enitites/VersionEntity';
import {Logger} from '../../../Logger';
import {MediaEntity} from './enitites/MediaEntity';
import {VideoEntity} from './enitites/VideoEntity';
import {DataStructureVersion} from '../../../../common/DataStructureVersion';
import {FileEntity} from './enitites/FileEntity';
import {FaceRegionEntry} from './enitites/FaceRegionEntry';
import {PersonEntry} from './enitites/PersonEntry';
import {Utils} from '../../../../common/Utils';
import * as path from 'path';
import {DatabaseType, ServerDataBaseConfig, SQLLogLevel} from '../../../../common/config/private/PrivateConfig';
import {AlbumBaseEntity} from './enitites/album/AlbumBaseEntity';
import {SavedSearchEntity} from './enitites/album/SavedSearchEntity';

const LOG_TAG = '[SQLConnection]';

export class SQLConnection {


  private static connection: Connection = null;

  constructor() {
  }

  public static async getConnection(): Promise<Connection> {
    if (this.connection == null) {
      const options: any = this.getDriver(Config.Server.Database);
      //   options.name = 'main';
      options.entities = [
        UserEntity,
        FileEntity,
        FaceRegionEntry,
        PersonEntry,
        MediaEntity,
        PhotoEntity,
        VideoEntity,
        DirectoryEntity,
        SharingEntity,
        AlbumBaseEntity,
        SavedSearchEntity,
        VersionEntity
      ];
      options.synchronize = false;
      if (Config.Server.Log.sqlLevel !== SQLLogLevel.none) {
        options.logging = SQLLogLevel[Config.Server.Log.sqlLevel];
      }
      Logger.debug(LOG_TAG, 'Creating connection: ' + DatabaseType[Config.Server.Database.type]);
      this.connection = await this.createConnection(options);
      await SQLConnection.schemeSync(this.connection);
    }
    return this.connection;
  }

  public static async tryConnection(config: ServerDataBaseConfig): Promise<boolean> {
    try {
      await getConnection('test').close();
    } catch (err) {
    }
    const options: any = this.getDriver(config);
    options.name = 'test';
    options.entities = [
      UserEntity,
      FileEntity,
      FaceRegionEntry,
      PersonEntry,
      MediaEntity,
      PhotoEntity,
      VideoEntity,
      DirectoryEntity,
      SharingEntity,
      AlbumBaseEntity,
      SavedSearchEntity,
      VersionEntity
    ];
    options.synchronize = false;
    if (Config.Server.Log.sqlLevel !== SQLLogLevel.none) {
      options.logging = SQLLogLevel[Config.Server.Log.sqlLevel];
    }
    const conn = await this.createConnection(options);
    await SQLConnection.schemeSync(conn);
    await conn.close();
    return true;
  }

  public static async init(): Promise<void> {
    const connection = await this.getConnection();

    // Add dummy Admin to the db
    const userRepository = connection.getRepository(UserEntity);
    const admins = await userRepository.find({role: UserRoles.Admin});
    if (admins.length === 0) {
      const a = new UserEntity();
      a.name = 'admin';
      a.password = PasswordHelper.cryptPassword('admin');
      a.role = UserRoles.Admin;
      await userRepository.save(a);
    }

  }

  public static async close(): Promise<void> {
    try {
      if (this.connection != null) {
        await this.connection.close();
        this.connection = null;
      }
    } catch (err) {
      console.error('Error during closing sql db:');
      console.error(err);
    }
  }

  public static getSQLiteDB(config: ServerDataBaseConfig): any {
    return path.join(ProjectPath.getAbsolutePath(config.dbFolder), 'sqlite.db');
  }

  private static async createConnection(options: ConnectionOptions): Promise<Connection> {
    if (options.type === 'sqlite') {
      return await createConnection(options);
    }
    try {
      return await createConnection(options);
    } catch (e) {
      if (e.sqlMessage === 'Unknown database \'' + options.database + '\'') {
        Logger.debug(LOG_TAG, 'creating database: ' + options.database);
        const tmpOption = Utils.clone(options);
        // @ts-ignore
        delete tmpOption.database;
        const tmpConn = await createConnection(tmpOption);
        await tmpConn.query('CREATE DATABASE IF NOT EXISTS ' + options.database);
        await tmpConn.close();
        return await createConnection(options);
      }
      throw e;
    }
  }

  private static async schemeSync(connection: Connection): Promise<void> {
    let version = null;
    try {
      version = await connection.getRepository(VersionEntity).findOne();
    } catch (ex) {
    }
    if (version && version.version === DataStructureVersion) {
      return;
    }
    Logger.info(LOG_TAG, 'Updating database scheme');
    if (!version) {
      version = new VersionEntity();
    }
    version.version = DataStructureVersion;

    let users: UserEntity[] = [];
    try {
      users = await connection.getRepository(UserEntity).createQueryBuilder('user').getMany();
    } catch (ex) {
    }
    await connection.dropDatabase();
    await connection.synchronize();
    await connection.getRepository(VersionEntity).save(version);
    try {
      await connection.getRepository(UserEntity).save(users);
    } catch (e) {
      await connection.dropDatabase();
      await connection.synchronize();
      await connection.getRepository(VersionEntity).save(version);
      Logger.warn(LOG_TAG, 'Could not move users to the new db scheme, deleting them. Details:' + e.toString());
    }
  }

  private static getDriver(config: ServerDataBaseConfig): ConnectionOptions {
    let driver: ConnectionOptions = null;
    if (config.type === DatabaseType.mysql) {
      driver = {
        type: 'mysql',
        host: config.mysql.host,
        port: config.mysql.port,
        username: config.mysql.username,
        password: config.mysql.password,
        database: config.mysql.database,
        charset: 'utf8'
      };
    } else if (config.type === DatabaseType.sqlite) {
      driver = {
        type: 'better-sqlite3',
        database: path.join(ProjectPath.getAbsolutePath(config.dbFolder), config.sqlite.DBFileName)
      };
    }
    return driver;
  }

}
