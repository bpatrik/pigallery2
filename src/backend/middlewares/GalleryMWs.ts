import * as path from 'node:path';
import {promises as fsp} from 'node:fs';
import {ZipArchive} from 'archiver';
import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {ParentDirectoryDTO,} from '../../common/entities/DirectoryDTO';
import {ObjectManagers} from '../model/ObjectManagers';
import {DirectoryAccessTypes} from '../model/DirectoryAccess';
import {ContentWrapper, ContentWrapperUtils} from '../../common/entities/ContentWrapper';
import {ProjectPath} from '../ProjectPath';
import {Config} from '../../common/config/private/Config';
import {MediaDTO, MediaDTOUtils} from '../../common/entities/MediaDTO';
import {VideoDTO} from '../../common/entities/VideoDTO';
import {QueryParams} from '../../common/QueryParams';
import {VideoProcessing} from '../model/fileaccess/fileprocessing/VideoProcessing';
import {SearchQueryDTO, SearchQueryTypes,} from '../../common/entities/SearchQueryDTO';
import {LocationLookupException} from '../exceptions/LocationLookupException';
import {ServerTime} from './ServerTimingMWs';
import {SortByTypes} from '../../common/entities/SortingMethods';
import {RequestParams} from './RequestParams';
import {RequestSession} from './RequestSession';

export class GalleryMWs {
  /**
   * Middleware to safely parse searchQueryDTO from URL parameters
   * Handles URL decoding and JSON parsing with proper error handling
   */
  public static parseSearchQuery(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      const rawQueryParam = RequestParams.get(req, 'searchQueryDTO');
      if (!rawQueryParam) {
        return next();
      }

      let query: SearchQueryDTO;
      try {
        query = JSON.parse(rawQueryParam) as SearchQueryDTO;
      } catch (parseError) {
        return next(
          new ErrorDTO(
            ErrorCodes.INPUT_ERROR,
            'Invalid search query JSON: ' + (parseError as SyntaxError).message, // JSON.parse only throws SyntaxError
            parseError
          )
        );
      }

      // Store the parsed query for use by subsequent middlewares
      req.resultPipe = query;
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Error parsing search query', err)
      );
    }
  }

  @ServerTime('1.db', 'List Directory')
  public static async listDirectory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const directoryName = RequestParams.get(req, 'directory') || '/';
    const absoluteDirectoryName = ProjectPath.resolveInImageFolder(directoryName);
    // set by AuthenticationMWs.authoriseDirectory
    const access = req.directoryAccess ?? DirectoryAccessTypes.available;
    let isDirectory = false;
    try {
      isDirectory = !!absoluteDirectoryName && (await fsp.stat(absoluteDirectoryName)).isDirectory();
    } catch {
      // not existing
    }
    if (!isDirectory) {
      // the same answer as AuthenticationMWs.authoriseDirectory gives for not available directories
      return next(new ErrorDTO(ErrorCodes.DIRECTORY_NOT_FOUND, 'Directory not found'));
    }

    try {
      const directory =
        await ObjectManagers.getInstance().GalleryManager.listDirectory(
          RequestSession.getContext(req),
          directoryName,
          parseInt(
            req.query[QueryParams.gallery.knownLastModified] as string,
            10
          ),
          parseInt(
            req.query[QueryParams.gallery.knownLastScanned] as string,
            10
          ),
          {
            // sharing without directory query only sees already indexed directories with visible photos
            allowIndexing: !RequestSession.getContext(req).directoryAccess.byPhotos,
            // parents only show the way to the available directories
            withMetaFiles: access === DirectoryAccessTypes.available
          }
        );

      if (directory == null) {
        req.resultPipe = ContentWrapperUtils.build(null, null, true);
        return next();
      }
      directory.availableParents = RequestSession.getContext(req).directoryAccess.getAvailableParents(directoryName);
      req.resultPipe = ContentWrapperUtils.build(directory, null);
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error during listing the directory',
          err
        )
      );
    }
  }

  @ServerTime('1.zip', 'Zip Directory')
  public static async zipDirectory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (Config.Gallery.NavBar.enableDownloadZip === false) {
      return next();
    }

    if (Config.Search.enabled === false || !req.resultPipe) {
      return next();
    }

    // Handle search-query-based zip
    try {
      const query = req.resultPipe as SearchQueryDTO;

      // Get all media items from search
      const searchResult = await ObjectManagers.getInstance().SearchManager.search(
        RequestSession.getContext(req), query);

      if (!searchResult.media || searchResult.media.length === 0) {
        return next(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'No media found for zip'));
      }

      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', 'attachment; filename=SearchResults.zip');

      const archive = new ZipArchive({
        store: true, // disable compression
      });

      res.on('close', () => {
        console.log('zip ' + archive.pointer() + ' bytes');
      });

      archive.on('error', (err: Error) => {
        throw err;
      });

      archive.pipe(res);

      // Track used filenames (case insensitive)
      const usedNames = new Map<string, number>();

      // Add each media file to the archive with unique names
      for (const media of searchResult.media) {
        const mediaPath = path.join(
          ProjectPath.ImageFolder,
          media.directory.path,
          media.directory.name,
          media.name
        );

        // Get file extension and base name
        const ext = path.extname(media.name);
        const baseName = path.basename(media.name, ext);
        const lowerName = media.name.toLowerCase();

        // Check if this name was used before
        let uniqueName = media.name;
        const usedCount = usedNames.get(lowerName);
        if (usedCount !== undefined) {
          const count = usedCount + 1;
          usedNames.set(lowerName, count);
          uniqueName = baseName + '_' + count + ext;
        } else {
          usedNames.set(lowerName, 1);
        }

        archive.file(mediaPath, {name: uniqueName});
      }

      await archive.finalize();
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Error creating search results zip', err)
      );
    }
  }

  @ServerTime('3.pack', 'pack result')
  public static cleanUpGalleryResults(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.resultPipe) {
      return next();
    }

    const cw = req.resultPipe as ContentWrapper;
    if (cw.notModified === true) {
      return next();
    }

    if (Config.Media.Video.enabled === false) {
      if (cw.directory) {
        const removeVideos = (dir: ParentDirectoryDTO): void => {
          dir.media = dir.media.filter(
            (m): boolean => !MediaDTOUtils.isVideo(m)
          );
        };
        removeVideos(cw.directory);
      }
      if (cw.searchResult) {
        cw.searchResult.media = cw.searchResult.media.filter(
          (m): boolean => !MediaDTOUtils.isVideo(m)
        );
      }
    }

    if (Config.Media.LivePhoto.enabled) {
      const pairLivePhotos = (mediaList: MediaDTO[], parentDir?: ParentDirectoryDTO): MediaDTO[] => {
        // Build a map of (contentIdentifier + dirPath) → video for companion videos
        const companionMap = new Map<string, MediaDTO>();
        for (const m of mediaList) {
          if (
            MediaDTOUtils.isVideo(m) &&
            m.metadata?.contentIdentifier
          ) {
            const dir = m.directory || parentDir;
            const dirPath = path.join(dir?.path || '', dir?.name || '');
            companionMap.set(m.metadata.contentIdentifier + '|' + dirPath, m);
          }
        }

        // Pair photos with their companion videos, remove paired videos from list
        const pairedVideoKeys = new Set<string>();
        for (const m of mediaList) {
          if (
            !MediaDTOUtils.isVideo(m) &&
            m.metadata?.contentIdentifier
          ) {
            const dir = m.directory || parentDir;
            const dirPath = path.join(dir?.path || '', dir?.name || '');
            const key = m.metadata.contentIdentifier + '|' + dirPath;
            const companion = companionMap.get(key);
            if (companion) {
              const companionDir = companion.directory || parentDir;
              m.liveVideoPath = path.join(
                companionDir?.path || '',
                companionDir?.name || '',
                companion.name
              );
              const videoMeta = (companion as VideoDTO).metadata;
              m.liveVideoInfo = {
                name: companion.name,
                size: videoMeta.size,
                fileSize: videoMeta.fileSize,
                duration: videoMeta.duration,
                fps: videoMeta.fps,
                bitRate: videoMeta.bitRate,
              };
              pairedVideoKeys.add(key);
            }
          }
        }

        return mediaList.filter(
          (m) => {
            if (!MediaDTOUtils.isVideo(m) || !m.metadata?.contentIdentifier) {
              return true;
            }
            const dir = m.directory || parentDir;
            const dirPath = path.join(dir?.path || '', dir?.name || '');
            return !pairedVideoKeys.has(m.metadata.contentIdentifier + '|' + dirPath);
          }
        );
      };

      if (cw.directory) {
        cw.directory.media = pairLivePhotos(cw.directory.media, cw.directory);
      }
      if (cw.searchResult) {
        cw.searchResult.media = pairLivePhotos(cw.searchResult.media);
      }
    }

    // Always strip contentIdentifier from responses — it's a server-side
    // matching key, not needed by the client.
    const stripContentId = (media: MediaDTO[]) => {
      for (const m of media) {
        if (m.metadata?.contentIdentifier) {
          delete m.metadata.contentIdentifier;
        }
      }
    };
    if (cw.directory?.media) {
      stripContentId(cw.directory.media);
    }
    if (cw.searchResult?.media) {
      stripContentId(cw.searchResult.media);
    }

    req.resultPipe = ContentWrapperUtils.pack(cw);

    return next();
  }

  public static async loadFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const mediaPath = RequestParams.get(req, 'mediaPath');
    if (!mediaPath) {
      return next();
    }
    const fullMediaPath = ProjectPath.resolveInImageFolder(mediaPath);

    // check if file exist
    try {
      if (!fullMediaPath) {
        throw new Error('Path is outside of the image folder');
      }
      if ((await fsp.stat(fullMediaPath)).isDirectory()) {
        return next();
      }
    } catch {
      return next(
        new ErrorDTO(
          ErrorCodes.PATH_ERROR,
          'no such file:' + RequestParams.get(req, 'mediaPath'),
          'can\'t find file: ' + fullMediaPath
        )
      );
    }

    req.resultPipe = fullMediaPath;
    return next();
  }

  public static async loadBestFitVideo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.resultPipe) {
        return next();
      }
      const fullMediaPath = req.resultPipe as string;

      const convertedVideo =
        VideoProcessing.generateConvertedFilePath(fullMediaPath);

      // check if transcoded video exist
      await fsp.access(convertedVideo);
      req.resultPipe = convertedVideo;
      // eslint-disable-next-line no-empty
    } catch {
    }

    return next();
  }

  @ServerTime('1.db', 'Search')
  public static async search(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (
        Config.Search.enabled === false ||
        !req.resultPipe
      ) {
        return next();
      }

      const query = req.resultPipe as SearchQueryDTO;
      const result = await ObjectManagers.getInstance().SearchManager.search(
        RequestSession.getContext(req),
        query
      );

      result.directories.forEach(
        (dir): MediaDTO[] => (dir.media = dir.media || [])
      );
      req.resultPipe = ContentWrapperUtils.build(null, result);
      return next();
    } catch (err) {
      if (err instanceof LocationLookupException) {
        return next(
          new ErrorDTO(
            ErrorCodes.LocationLookUp_ERROR,
            'Cannot find location: ' + err.location,
            err
          )
        );
      }
      return next(
        new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Error during searching', err)
      );
    }
  }

  @ServerTime('1.db', 'Autocomplete')
  public static async autocomplete(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (Config.Search.AutoComplete.enabled === false) {
        return next();
      }
      const value = RequestParams.get(req, 'value');
      if (!value) {
        return next();
      }

      let type: SearchQueryTypes = SearchQueryTypes.any_text;
      if (req.query[QueryParams.gallery.search.type]) {
        type = parseInt(req.query[QueryParams.gallery.search.type] as string, 10);
      }
      req.resultPipe =
        await ObjectManagers.getInstance().SearchManager.autocomplete(
          RequestSession.getContext(req),
          value,
          type
        );
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Error during searching', err)
      );
    }
  }

  public static async getRandomImage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (
        Config.RandomPhoto.enabled === false ||
        !req.resultPipe
      ) {
        return next();
      }

      const query = req.resultPipe as SearchQueryDTO;

      const photos =
        await ObjectManagers.getInstance().SearchManager.getNMedia(
          RequestSession.getContext(req),
          query, [{method: SortByTypes.Random, ascending: null}], 1, true);
      if (!photos || photos.length !== 1) {
        return next(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'No photo found'));
      }

      req.params['mediaPath'] = path.join(
        photos[0].directory.path,
        photos[0].directory.name,
        photos[0].name
      );
      return next();
    } catch (e) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Can\'t get random photo: ' + String(e)
        )
      );
    }
  }

  public static async getMediaEntry(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {

      const mediaPath = RequestParams.get(req, 'mediaPath');
      if (!mediaPath) {
        return next();
      }

      req.resultPipe = await ObjectManagers.getInstance().GalleryManager.getMedia(RequestSession.getContext(req), mediaPath);
      return next();
    } catch (e) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Can\'t get random photo: ' + String(e)
        )
      );
    }
  }
}
