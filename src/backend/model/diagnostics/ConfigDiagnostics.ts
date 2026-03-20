import {PrivateConfigClass} from '../../../common/config/private/PrivateConfigClass';
import {Logger} from '../../Logger';
import {NotificationManager} from '../NotifocationManager';
import {SQLConnection} from '../database/SQLConnection';
import * as fs from 'fs';
import * as path from 'path';
import {FFmpegFactory} from '../FFmpegFactory';
import {
  ClientAlbumConfig,
  ClientFacesConfig,
  ClientMapConfig,
  ClientMetaFileConfig,
  ClientPhotoConfig,
  ClientRandomPhotoConfig,
  ClientSearchConfig,
  ClientSharingConfig,
  MapLayers,
  MapProviders,
} from '../../../common/config/public/ClientConfig';
import {
  DatabaseType,
  ServerAlbumCoverConfig,
  ServerDataBaseConfig,
  ServerJobConfig,
  ServerPhotoConfig,
  ServerVideoConfig,
} from '../../../common/config/private/PrivateConfig';
import {SearchQueryTypes, TextSearch,} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';
import {JobRepository} from '../jobs/JobRepository';
import {ConfigClassBuilder} from '../../../../node_modules/typeconfig/node';
import {Config} from '../../../common/config/private/Config';
import {SupportedFormats} from '../../../common/SupportedFormats';
import {MediaRendererInput, PhotoWorker, ThumbnailSourceType} from '../fileaccess/PhotoWorker';

const LOG_TAG = '[ConfigDiagnostics]';

export class ConfigDiagnostics {
  private static adjustConfigWarn = 'Please adjust the config properly: manually edit the confing in the UI OR edit directly the config.json or even fully delete the config.json and let the app create a new one.';

  static testAlbumsConfig(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    albumConfig: ClientAlbumConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    original: PrivateConfigClass
  ): void {
    Logger.debug(LOG_TAG, 'Testing album config');
    // nothing to check
  }

  static checkReadWritePermission(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line no-bitwise
      fs.access(path, fs.constants.R_OK | fs.constants.W_OK, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  static async testDatabase(
    databaseConfig: ServerDataBaseConfig
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing database config');
    await SQLConnection.tryConnection(databaseConfig);
    if (databaseConfig.type === DatabaseType.sqlite) {
      try {
        await this.checkReadWritePermission(
          SQLConnection.getSQLiteDB(databaseConfig)
        );
      } catch (e) {
        throw new Error(
          'Cannot read or write sqlite storage file: ' +
          SQLConnection.getSQLiteDB(databaseConfig)
        );
      }
    }
  }

  static async testJobsConfig(
    jobsConfig: ServerJobConfig
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing jobs config');
    for (let i = 0; i < jobsConfig.scheduled.length; ++i) {
      const j = jobsConfig.scheduled[i];
      if (!JobRepository.Instance.exists(j.name)) {
        throw new Error(`Unknown Job: "${j.name}". The app does not support this job. Please remove it from the config.`);
      }
    }
  }

  static async testMetaFileConfig(
    metaFileConfig: ClientMetaFileConfig,
    config: PrivateConfigClass
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing meta file config');
    if (metaFileConfig.gpx === true && config.Map.enabled === false) {
      throw new Error('*.gpx meta files are not supported without MAP');
    }
  }


  static testVideoConfig(videoConfig: ServerVideoConfig,
                         config: PrivateConfigClass): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing video config with ffmpeg test');
    return new Promise((resolve, reject) => {
      try {

        if (config.Media.Video.enabled === true) {
          if (videoConfig.transcoding.fps <= 0) {
            throw new Error('fps should be grater than 0');
          }
        }
        if (videoConfig.enabled === true) {
          const ffmpeg = FFmpegFactory.get();
          ffmpeg().getAvailableCodecs((err: Error) => {
            if (err) {
              return reject(
                new Error(
                  'Error accessing ffmpeg, cant find executable: ' +
                  err.toString()
                )
              );
            }
            ffmpeg(__dirname + '/blank.jpg').ffprobe((err2: Error) => {
              if (err2) {
                return reject(
                  new Error(
                    'Error accessing ffmpeg-probe, cant find executable: ' +
                    err2.toString()
                  )
                );
              }
              return resolve();
            });
          });
        } else {
          return resolve();
        }
      } catch (e) {
        return reject(new Error('unknown video error: ' + e.toString()));
      }
    });
  }


  static async testSharp(): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing sharp package');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require('sharp');
    sharp();
  }

  static async testTempFolder(folder: string): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing temp folder');
    await this.checkReadWritePermission(folder);
  }

  static testImageFolder(folder: string): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing images folder');
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(folder)) {
        reject('Images folder not exists: \'' + folder + '\'');
      }
      fs.access(folder, fs.constants.R_OK, (err) => {
        if (err) {
          reject({
            message: 'Error during getting read access to images folder',
            error: err.toString(),
          });
        }
      });
      resolve();
    });
  }


  static async testPhotoConfig(
    photoConfig: ServerPhotoConfig
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing thumbnail config');


    if (photoConfig.personFaceMargin < 0 || photoConfig.personFaceMargin > 1) {
      throw new Error('personFaceMargin should be between 0 and 1');
    }

    if (isNaN(photoConfig.iconSize) || photoConfig.iconSize <= 0) {
      throw new Error(
        'IconSize has to be >= 0 integer, got: ' + photoConfig.iconSize
      );
    }

    if (!photoConfig.thumbnailSizes.length) {
      throw new Error('At least one thumbnail size is needed');
    }
    for (const item of photoConfig.thumbnailSizes) {
      if (isNaN(item) || item <= 0) {
        throw new Error('Thumbnail size has to be >= 0 integer, got: ' + item);
      }
    }
  }

  static async testTasksConfig(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    task: ServerJobConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: PrivateConfigClass
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing tasks config');
    return;
  }

  static async testFacesConfig(
    faces: ClientFacesConfig,
    config: PrivateConfigClass
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing faces config');
    if (faces.enabled === true) {
      if (config.Search.enabled === false) {
        throw new Error('Faces support needs enabled search');
      }
    }
  }

  static async testSearchConfig(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    search: ClientSearchConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: PrivateConfigClass
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing search config');
    //nothing to check
  }

  static async testSharingConfig(
    sharing: ClientSharingConfig,
    config: PrivateConfigClass
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing sharing config');
    if (
      sharing.enabled === true &&
      config.Users.authenticationRequired === false
    ) {
      throw new Error('In case of no authentication, sharing is not supported');
    }
  }

  static async testRandomPhotoConfig(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sharing: ClientRandomPhotoConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: PrivateConfigClass
  ): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing random photo config');
    //nothing to check
  }

  static async testMapConfig(map: ClientMapConfig): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing map config');
    if (map.enabled === false) {
      return;
    }
    if (
      map.mapProvider === MapProviders.Mapbox &&
      (!map.mapboxAccessToken || map.mapboxAccessToken.length === 0)
    ) {
      throw new Error('Mapbox needs a valid api key.');
    }
    if (
      map.mapProvider === MapProviders.Custom &&
      (!map.customLayers || map.customLayers.length === 0)
    ) {
      throw new Error('Custom maps need at least one valid layer');
    }
    if (map.mapProvider === MapProviders.Custom) {
      map.customLayers.forEach((l: MapLayers) => {
        if (!l.url || l.url.length === 0) {
          throw new Error('Custom maps url need to be a valid layer');
        }
      });
    }
  }

  static async testAlbumCoverConfig(settings: ServerAlbumCoverConfig): Promise<void> {
    Logger.debug(LOG_TAG, 'Testing cover config');
    SearchQueryUtils.validateSearchQuery(settings.SearchQuery, 'SearchQuery');
  }

  /**
   * Removes unsupported image formats.
   * It is possible that some OS support one or the other image formats (like macOS does with HEIC),
   * but others do not.
   * Those formats are added to the config but dynamically removed.
   * @param config
   */
  static async removeUnsupportedPhotoExtensions(config: ClientPhotoConfig): Promise<void> {
    Logger.verbose(LOG_TAG, 'Checking for supported image formats');

    const sharp = require('sharp');
    let text = '';
    for (const f in sharp.format) {
      text += `${f}: {\n\tid:${JSON.stringify(sharp.format[f].id)},\n\tinput:${JSON.stringify(sharp.format[f].input)},\n\toutput:${JSON.stringify(sharp.format[f].output)}}\n`;
    }
    Logger.silly(LOG_TAG, 'Sharp supports:\n' + text);
    Logger.silly(LOG_TAG, 'Sharp versions:' + JSON.stringify(sharp.versions));

    let removedSome = false;
    let i = config.supportedFormats.length;
    while (i--) {
      const ext = config.supportedFormats[i].toLowerCase();
      const testImage = path.join(__dirname, 'image_formats', 'test.' + ext);
      // Check if a test available for this image format.
      // if not probably because it is trivial
      if (!fs.existsSync(testImage)) {
        Logger.debug(LOG_TAG, `❕ ${ext} image format has no test. skipping.`);
        continue;
      }
      try {
        await PhotoWorker.renderFromImage({
            type: ThumbnailSourceType.Photo,
            mediaPath: testImage,
            size: 10,
            useLanczos3: Config.Media.Photo.useLanczos3,
            quality: Config.Media.Photo.quality,
            smartSubsample: Config.Media.Photo.smartSubsample,
          } as MediaRendererInput, true
        );
        Logger.debug(LOG_TAG, `✔️ ${ext} image formats tested successfully.`);
      } catch (e) {
        Logger.verbose(e);
        Logger.verbose(LOG_TAG, `❌ ${ext} image format tested failed, removing it form config.`);
        config.supportedFormats.splice(i, 1);
        removedSome = true;
      }
    }
    if (removedSome) {
      SupportedFormats.init();
    }
  }

  static async testConfig(config: PrivateConfigClass): Promise<void> {

    await ConfigDiagnostics.testDatabase(config.Database);
    await ConfigDiagnostics.testSharp();
    await ConfigDiagnostics.testTempFolder(config.Media.tempFolder);
    await ConfigDiagnostics.testVideoConfig(config.Media.Video, config);
    await ConfigDiagnostics.testMetaFileConfig(config.MetaFile, config);
    await ConfigDiagnostics.testAlbumsConfig(config.Album, config);
    await ConfigDiagnostics.testImageFolder(config.Media.folder);
    await ConfigDiagnostics.testPhotoConfig(config.Media.Photo);
    await ConfigDiagnostics.testSearchConfig(config.Search, config);
    await ConfigDiagnostics.testAlbumCoverConfig(config.AlbumCover);
    await ConfigDiagnostics.testFacesConfig(config.Faces, config);
    await ConfigDiagnostics.testTasksConfig(config.Jobs, config);
    await ConfigDiagnostics.testSharingConfig(config.Sharing, config);
    await ConfigDiagnostics.testRandomPhotoConfig(config.Sharing, config);
    await ConfigDiagnostics.testMapConfig(config.Map);
    await ConfigDiagnostics.testJobsConfig(config.Jobs);
  }


  static async runDiagnostics(): Promise<void> {

    if (process.env['NODE_ENV'] === 'debug') {
      NotificationManager.warning('You are running the application with NODE_ENV=debug. This exposes a lot of debug information that can be a security vulnerability. Set NODE_ENV=production, when you finished debugging.');
    }

    if(!global.gc){
      Logger.debug(LOG_TAG, 'Garbage collector is not available, the app won\'t be able to manually trigger it to save RAM.');
    }

    try {
      await ConfigDiagnostics.testDatabase(Config.Database);
    } catch (ex) {
      const err: Error = ex;
      Logger.warn(LOG_TAG, '[SQL error]', err.toString());
      Logger.error(
        LOG_TAG,
        'Error during initializing SQL DB, check DB connection and settings'
      );
      process.exit(1);
    }

    try {
      await ConfigDiagnostics.testSharp();
    } catch (ex) {
      const err: Error = ex;

      Logger.warn(
        LOG_TAG,
        '[Thumbnail hardware acceleration] module error: ',
        err.toString()
      );
      Logger.warn(
        LOG_TAG,
        'Thumbnail hardware acceleration is not possible.' +
        ' \'sharp\' node module is not found.' +
        ' Falling back temporally to JS based thumbnail generation'
      );
      process.exit(1);
    }

    try {
      await ConfigDiagnostics.testTempFolder(Config.Media.tempFolder);
    } catch (ex) {
      const err: Error = ex;
      NotificationManager.error('Thumbnail folder error', err.toString());
      Logger.error(LOG_TAG, 'Thumbnail folder error', err.toString());
    }

    try {
      await ConfigDiagnostics.testVideoConfig(Config.Media.Video, Config);
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Video support error, switching off..' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG,errorText,
        err.toString()
      );
      Config.Media.Video.enabled = false;
    }

    try {
      await ConfigDiagnostics.testMetaFileConfig(
        Config.MetaFile,
        Config
      );
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Meta file support error, switching off gpx..' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG, errorText,
        err.toString()
      );
      Config.MetaFile.gpx = false;
    }

    try {
       ConfigDiagnostics.testAlbumsConfig(Config.Album, Config);
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Albums support error, switching off..' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG, errorText,
        err.toString()
      );
      Config.Album.enabled = false;
    }

    try {
      await ConfigDiagnostics.testImageFolder(Config.Media.folder);
    } catch (ex) {
      const err: Error = ex;
      NotificationManager.error('Images folder error', err.toString());
      Logger.error(LOG_TAG, 'Images folder error', err.toString());
    }
    try {
      await ConfigDiagnostics.testPhotoConfig(
        Config.Media.Photo
      );
    } catch (ex) {
      const err: Error = ex;
      NotificationManager.error('Thumbnail settings error', err.toString());
      Logger.error(LOG_TAG, 'Thumbnail settings error', err.toString());
    }

    try {
      await ConfigDiagnostics.testSearchConfig(Config.Search, Config);
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Search is not supported with these settings. Disabling temporally. ' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG, errorText,
        err.toString()
      );
      Config.Search.enabled = false;
    }

    try {
      await ConfigDiagnostics.testAlbumCoverConfig(Config.AlbumCover);
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Cover settings are not valid, resetting search query' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG, errorText,
        err.toString()
      );
      Config.AlbumCover.SearchQuery = {
        type: SearchQueryTypes.any_text,
        value: '',
      } as TextSearch;
    }

    try {
      await ConfigDiagnostics.testFacesConfig(Config.Faces, Config);
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Faces are not supported with these settings. Disabling temporally. ' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG, errorText,
        err.toString()
      );
      Config.Faces.enabled = false;
    }

    try {
      await ConfigDiagnostics.testTasksConfig(Config.Jobs, Config);
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Some Tasks are not supported with these settings. Disabling temporally. ' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG, errorText,
        err.toString()
      );
      Config.Faces.enabled = false;
    }

    try {
      await ConfigDiagnostics.testSharingConfig(Config.Sharing, Config);
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Sharing is not supported with these settings. Disabling temporally. ' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG, errorText,
        err.toString()
      );
      Config.Sharing.enabled = false;
    }

    try {
      await ConfigDiagnostics.testRandomPhotoConfig(
        Config.Sharing,
        Config
      );
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Random Media is not supported with these settings. Disabling temporally.. ' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(
        errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG,
        errorText,
        err.toString()
      );
      Config.Sharing.enabled = false;
    }

    try {
      await ConfigDiagnostics.testMapConfig(Config.Map);
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Maps is not supported with these settings. Using open street maps temporally. ' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(
        errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG,
        errorText,
        err.toString()
      );
      Config.Map.mapProvider = MapProviders.OpenStreetMap;
    }


    try {
      await ConfigDiagnostics.testJobsConfig(
        Config.Jobs,
      );
    } catch (ex) {
      const err: Error = ex;
      const errorText = 'Jobs error. Resetting config to default for now to let the app start up. ' + ConfigDiagnostics.adjustConfigWarn;
      NotificationManager.warning(errorText,
        err.toString()
      );
      Logger.warn(
        LOG_TAG, errorText,
        err.toString()
      );
      const pc = ConfigClassBuilder.attachPrivateInterface(new PrivateConfigClass());
      Config.Jobs.scheduled = pc.Jobs.scheduled;
    }

    await this.removeUnsupportedPhotoExtensions(Config.Media.Photo);

    if(Config.Media.Photo.supportedFormats.length === 0){
      Logger.error(LOG_TAG, 'No supported image formats found. Something is off. Exiting...');
      process.exit(1);
    }


    if(Config.Media.Photo.supportedFormats.findIndex(v => v.toLowerCase() === 'jpg') === -1){
      Logger.error(LOG_TAG, 'JPG is not part of the supported image formats. Something is off. Exiting...');
      process.exit(1);
    }

  }

}
