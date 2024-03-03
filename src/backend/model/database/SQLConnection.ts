import 'reflect-metadata';
import {Connection, createConnection, DataSourceOptions, getConnection, LoggerOptions,} from 'typeorm';
import {UserEntity} from './enitites/UserEntity';
import {UserRoles} from '../../../common/entities/UserDTO';
import {PhotoEntity} from './enitites/PhotoEntity';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {Config} from '../../../common/config/private/Config';
import {SharingEntity} from './enitites/SharingEntity';
import {PasswordHelper} from '../PasswordHelper';
import {ProjectPath} from '../../ProjectPath';
import {VersionEntity} from './enitites/VersionEntity';
import {Logger} from '../../Logger';
import {MediaEntity} from './enitites/MediaEntity';
import {VideoEntity} from './enitites/VideoEntity';
import {DataStructureVersion} from '../../../common/DataStructureVersion';
import {FileEntity} from './enitites/FileEntity';
import {PersonEntry} from './enitites/PersonEntry';
import {Utils} from '../../../common/Utils';
import * as path from 'path';
import {DatabaseType, ServerDataBaseConfig, SQLLogLevel,} from '../../../common/config/private/PrivateConfig';
import {AlbumBaseEntity} from './enitites/album/AlbumBaseEntity';
import {SavedSearchEntity} from './enitites/album/SavedSearchEntity';
import {NotificationManager} from '../NotifocationManager';
import {PersonJunctionTable} from './enitites/PersonJunctionTable';
import {MDFileEntity} from './enitites/MDFileEntity';

const LOG_TAG = '[SQLConnection]';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export class SQLConnection {
  // eslint-disable-next-line @typescript-eslint/ban-types
  public static getEntries(): Function[] {
    return this.entries;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public static async addEntries(tables: Function[]) {
    if (!tables?.length) {
      return;
    }
    await this.close();
    this.entries = Utils.getUnique(this.entries.concat(tables));
    await (await this.getConnection()).synchronize();
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  private static entries: Function[] = [
    UserEntity,
    FileEntity,
    MDFileEntity,
    PersonJunctionTable,
    PersonEntry,
    MediaEntity,
    PhotoEntity,
    VideoEntity,
    DirectoryEntity,
    SharingEntity,
    AlbumBaseEntity,
    SavedSearchEntity,
    VersionEntity,
  ];

  private static connection: Connection = null;


  public static async getConnection(): Promise<Connection> {
    if (this.connection == null) {
      const options = this.getDriver(Config.Database);

      Logger.debug(
        LOG_TAG,
        'Creating connection: ' + DatabaseType[Config.Database.type],
        ', with driver:',
        options.type
      );
      this.connection = await this.createConnection(options);
      await SQLConnection.schemeSync(this.connection);
    }
    return this.connection;
  }

  public static async tryConnection(
    config: ServerDataBaseConfig
  ): Promise<boolean> {
    try {
      await getConnection('test').close();
      // eslint-disable-next-line no-empty
    } catch (err) {
    }
    const options = this.getDriver(config);
    options.name = 'test';
    const conn = await this.createConnection(options);
    await SQLConnection.schemeSync(conn);
    await conn.close();
    return true;
  }

  public static async init(): Promise<void> {
    const connection = await this.getConnection();

    if (Config.Users.authenticationRequired !== true) {
      return;
    }
    // Adding enforced users to the db
    const userRepository = connection.getRepository(UserEntity);
    if (
      Array.isArray(Config.Users.enforcedUsers) &&
      Config.Users.enforcedUsers.length > 0
    ) {
      for (let i = 0; i < Config.Users.enforcedUsers.length; ++i) {
        const uc = Config.Users.enforcedUsers[i];
        const user = await userRepository.findOneBy({name: uc.name});
        if (!user) {
          Logger.info(LOG_TAG, 'Saving enforced user: ' + uc.name);
          const a = new UserEntity();
          a.name = uc.name;
          a.password = uc.encryptedPassword;
          a.role = uc.role;
          await userRepository.save(a);
        }
      }
    }

    // Add dummy Admin to the db
    const admins = await userRepository.findBy({role: UserRoles.Admin});
    const devs = await userRepository.findBy({role: UserRoles.Developer});
    if (admins.length === 0 && devs.length === 0) {
      const a = new UserEntity();
      a.name = 'admin';
      a.password = PasswordHelper.cryptPassword('admin');
      a.role = UserRoles.Admin;
      await userRepository.save(a);
    }

    const defAdmin = await userRepository.findOneBy({
      name: 'admin',
      role: UserRoles.Admin,
    });
    if (
      defAdmin &&
      PasswordHelper.comparePassword('admin', defAdmin.password)
    ) {
      NotificationManager.error(
        'Using default admin user!',
        'You are using the default admin/admin user/password, please change or remove it.'
      );
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

  private static FIXED_SQL_TABLE = [
    'sqlite_sequence'
  ];

  /**
   * Clears up the DB from unused tables. use it when the entities list are up-to-date (extensions won't add any new)
   */
  public static async removeUnusedTables() {
    const conn = await this.getConnection();
    const validTableNames = this.entries.map(e => conn.getRepository(e).metadata.tableName).concat(this.FIXED_SQL_TABLE);
    let currentTables: string[];

    if (Config.Database.type === DatabaseType.sqlite) {
      currentTables = (await conn.query('SELECT name FROM sqlite_master  WHERE type=\'table\''))
        .map((r: { name: string }) => r.name);
    } else {
      currentTables = (await conn.query(`SELECT table_name FROM information_schema.tables ` +
        `WHERE table_schema = '${Config.Database.mysql.database}'`))
        .map((r: { table_name: string }) => r.table_name);
    }

    const tableToDrop = currentTables.filter(ct => !validTableNames.includes(ct));
    for (let i = 0; i < tableToDrop.length; ++i) {
      await conn.query('DROP TABLE ' + tableToDrop[i]);
    }
  }

  public static getSQLiteDB(config: ServerDataBaseConfig): string {
    return path.join(ProjectPath.getAbsolutePath(config.dbFolder), 'sqlite.db');
  }

  private static async createConnection(
    options: DataSourceOptions
  ): Promise<Connection> {
    if (options.type === 'sqlite' || options.type === 'better-sqlite3') {
      return await createConnection(options);
    }
    try {
      return await createConnection(options);
    } catch (e) {
      if (e.sqlMessage === 'Unknown database \'' + options.database + '\'') {
        Logger.debug(LOG_TAG, 'creating database: ' + options.database);
        const tmpOption = Utils.clone(options);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        delete tmpOption.database;
        const tmpConn = await createConnection(tmpOption);
        await tmpConn.query(
          'CREATE DATABASE IF NOT EXISTS ' + options.database
        );
        await tmpConn.close();
        return await createConnection(options);
      }
      throw e;
    }
  }

  private static async schemeSync(connection: Connection): Promise<void> {
    let version = null;
    try {
      version = (await connection.getRepository(VersionEntity).find())[0];
      // eslint-disable-next-line no-empty
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
      users = await connection
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .getMany();
      // eslint-disable-next-line no-empty
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
      Logger.warn(
        LOG_TAG,
        'Could not move users to the new db scheme, deleting them. Details:' +
        e.toString()
      );
    }
  }


  private static getDriver(config: ServerDataBaseConfig): Writeable<DataSourceOptions> {
    let driver: Writeable<DataSourceOptions>;
    if (config.type === DatabaseType.mysql) {
      driver = {
        type: 'mysql',
        host: config.mysql.host,
        port: config.mysql.port,
        username: config.mysql.username,
        password: config.mysql.password,
        database: config.mysql.database,
        charset: 'utf8mb4',
      };
    } else if (config.type === DatabaseType.sqlite) {
      driver = {
        type: 'better-sqlite3',
        database: path.join(
          ProjectPath.getAbsolutePath(config.dbFolder),
          config.sqlite.DBFileName
        ),
      };
    }
    driver.entities = this.entries;
    driver.synchronize = false;
    if (Config.Server.Log.sqlLevel !== SQLLogLevel.none) {
      driver.logging = SQLLogLevel[Config.Server.Log.sqlLevel] as LoggerOptions;
    }
    return driver;
  }
}
