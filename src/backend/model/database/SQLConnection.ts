import 'reflect-metadata';
import {DataSource, DataSourceOptions, LoggerOptions} from 'typeorm';
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
import {PersonEntry} from './enitites/person/PersonEntry';
import {Utils} from '../../../common/Utils';
import * as path from 'node:path';
import {DatabaseType, MySQLConfig, ServerDataBaseConfig, SQLiteConfig, SQLLogLevel,} from '../../../common/config/private/PrivateConfig';
import {AlbumBaseEntity} from './enitites/album/AlbumBaseEntity';
import {SavedSearchEntity} from './enitites/album/SavedSearchEntity';
import {NotificationManager} from '../NotifocationManager';
import {PersonJunctionTable} from './enitites/person/PersonJunctionTable';
import {MDFileEntity} from './enitites/MDFileEntity';
import {ProjectedDirectoryCacheEntity} from './enitites/ProjectedDirectoryCacheEntity';
import {ProjectedPersonCacheEntity} from './enitites/person/ProjectedPersonCacheEntity';
import {ProjectedAlbumCacheEntity} from './enitites/album/ProjectedAlbumCacheEntity';
import {foldText} from './enitites/EntityUtils';

const LOG_TAG = '[SQLConnection]';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
// the part of better-sqlite3's Database that is used here
interface BetterSqlite3Db {
  function(name: string, options: { deterministic: boolean }, fn: (text: string | null) => string | null): void;
}

export class SQLConnection {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
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
    // projection-aware cache entries
    ProjectedDirectoryCacheEntity,
    ProjectedPersonCacheEntity,
    ProjectedAlbumCacheEntity
  ];
  private static connection: DataSource | null = null;
  private static FIXED_SQL_TABLE = [
    'sqlite_sequence'
  ];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  public static getEntries(): Function[] {
    return this.entries;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  public static async addEntries(tables: Function[]) {
    if (!tables?.length) {
      return;
    }
    await this.close();
    this.entries = Utils.getUnique(this.entries.concat(tables));
    await (await this.getConnection()).synchronize();
  }

  public static async getConnection(): Promise<DataSource> {
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
    const conn = await this.createConnection(this.getDriver(config));
    try {
      await SQLConnection.schemeSync(conn);
    } finally {
      await conn.destroy();
    }
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
          if (!uc.encryptedPassword) {
            // the config loader encrypts the password of every enforced user
            throw new Error('Enforced user has no password: ' + uc.name);
          }
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
      if (!Config.Users.suppressDefUserWarn) {
        NotificationManager.error(
          'Using default admin user!',
          'You are using the default user: "admin", password: "admin". The is a security issue. Please change the password or remove the user.'
        );
      }
    }
  }

  public static async close(): Promise<void> {
    try {
      if (this.connection != null) {
        await this.connection.destroy();
        this.connection = null;
      }
    } catch (err) {
      console.error('Error during closing sql db:');
      console.error(err);
    }
  }

  /**
   * Clears up the DB from unused tables. use it when the entities list are up-to-date (extensions won't add any new)
   */
  public static async removeUnusedTables() {
    const conn = await this.getConnection();
    const validTableNames = this.entries.map(e => conn.getRepository(e).metadata.tableName).concat(this.FIXED_SQL_TABLE);
    let currentTables: string[];

    if (Config.Database.type === DatabaseType.sqlite) {
      currentTables = (await conn.query<{ name: string }[]>('SELECT name FROM sqlite_master  WHERE type=\'table\''))
        .map((r) => r.name);
    } else {
      currentTables = (await conn.query<{ table_name: string }[]>(`SELECT table_name
                                         FROM information_schema.tables ` +
        `WHERE table_schema = '${SQLConnection.getMySQLConfig(Config.Database).database}'`))
        .map((r) => r.table_name);
    }

    const tableToDrop = currentTables.filter(ct => !validTableNames.includes(ct));
    for (let i = 0; i < tableToDrop.length; ++i) {
      await conn.query('DROP TABLE ' + tableToDrop[i]);
    }
  }

  public static getSQLiteDB(config: ServerDataBaseConfig): string {
    return path.join(ProjectPath.getAbsolutePath(config.dbFolder), SQLConnection.getSQLiteConfig(Config.Database).DBFileName);
  }

  private static async createConnection(
    options: DataSourceOptions
  ): Promise<DataSource> {
    const initialize = (o: DataSourceOptions): Promise<DataSource> => new DataSource(o).initialize();
    if (options.type === 'better-sqlite3') {
      return await initialize(options);
    }
    try {
      return await initialize(options);
    } catch (e) {
      if (e instanceof Error && 'sqlMessage' in e && e.sqlMessage === 'Unknown database \'' + String(options.database) + '\'') {
        Logger.debug(LOG_TAG, 'creating database: ' + String(options.database));
        const tmpOption = Utils.clone(options);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        delete tmpOption.database;
          const tmpConn = await initialize(tmpOption);
        await tmpConn.query(
          'CREATE DATABASE IF NOT EXISTS ' + String(options.database)
        );
        await tmpConn.destroy();
          return await initialize(options);
      }
      throw e;
    }
  }

  private static async schemeSync(connection: DataSource): Promise<void> {
    let version = null;
    try {
      version = (await connection.getRepository(VersionEntity).find())[0];
      // eslint-disable-next-line no-empty
    } catch {
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
      // only select the columns that exist in the old scheme, so adding a column to the user does not lose the users
      const metadata = connection.getMetadata(UserEntity);
      const queryRunner = connection.createQueryRunner();
      const table = await queryRunner.getTable(metadata.tableName);
      await queryRunner.release();
      const existingColumns = new Set((table?.columns || []).map(c => c.name));
      users = await connection
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .select(metadata.columns
          .filter(c => existingColumns.has(c.databaseName))
          .map(c => 'user.' + c.propertyName))
        .getMany();
      // eslint-disable-next-line no-empty
    } catch {
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
        String(e)
      );
    }
  }


  private static getMySQLConfig(config: ServerDataBaseConfig): MySQLConfig {
    if (!config.mysql) {
      throw new Error('MySQL is selected, but its config is missing');
    }
    return config.mysql;
  }

  private static getSQLiteConfig(config: ServerDataBaseConfig): SQLiteConfig {
    if (!config.sqlite) {
      throw new Error('SQLite is selected, but its config is missing');
    }
    return config.sqlite;
  }

  private static getDriver(config: ServerDataBaseConfig): Writeable<DataSourceOptions> {
    let driver: Writeable<DataSourceOptions>;
    if (config.type === DatabaseType.mysql) {
      const mysql = SQLConnection.getMySQLConfig(config);
      driver = {
        type: 'mysql',
        host: mysql.host,
        port: mysql.port,
        username: mysql.username,
        password: mysql.password,
        database: mysql.database,
        charset: 'utf8mb4',
      };
    } else if (config.type === DatabaseType.sqlite) {
      driver = {
        type: 'better-sqlite3',
        database: path.join(
          ProjectPath.getAbsolutePath(config.dbFolder),
          SQLConnection.getSQLiteConfig(config).DBFileName
        ),
        // for the accent- and case-insensitive search (#1309)
        prepareDatabase: (db: BetterSqlite3Db): void => {
          db.function('fold', {deterministic: true}, foldText);
        },
      };
    } else {
      throw new Error('Unsupported database type: ' + String(config.type));
    }
    driver.entities = this.entries;
    driver.synchronize = false;
    if (Config.Server.Log.sqlLevel !== SQLLogLevel.none) {
      driver.logging = SQLLogLevel[Config.Server.Log.sqlLevel] as LoggerOptions;
    }
    return driver;
  }
}
