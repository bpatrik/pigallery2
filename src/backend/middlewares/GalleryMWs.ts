import * as path from 'path';
import {promises as fsp} from 'fs';
import * as archiver from 'archiver';
import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {ParentDirectoryDTO,} from '../../common/entities/DirectoryDTO';
import {ObjectManagers} from '../model/ObjectManagers';
import {ContentWrapper, ContentWrapperUtils} from '../../common/entities/ContentWrapper';
import {ProjectPath} from '../ProjectPath';
import {Config} from '../../common/config/private/Config';
import {MediaDTO, MediaDTOUtils} from '../../common/entities/MediaDTO';
import {QueryParams} from '../../common/QueryParams';
import {VideoProcessing} from '../model/fileaccess/fileprocessing/VideoProcessing';
import {SearchQueryDTO, SearchQueryTypes,} from '../../common/entities/SearchQueryDTO';
import {LocationLookupException} from '../exceptions/LocationLookupException';
import {ServerTime} from './ServerTimingMWs';
import {SortByTypes} from '../../common/entities/SortingMethods';

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
      if (!req.params['searchQueryDTO']) {
        return next();
      }

      let rawQueryParam = req.params['searchQueryDTO'] as string;

      let query: SearchQueryDTO;
      try {
        query = JSON.parse(rawQueryParam);
      } catch (parseError) {
        return next(
          new ErrorDTO(
            ErrorCodes.INPUT_ERROR,
            'Invalid search query JSON: ' + parseError.message,
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
    const directoryName = req.params['directory'] || '/';
    const absoluteDirectoryName = path.join(
      ProjectPath.ImageFolder,
      directoryName
    );
    try {
      if ((await fsp.stat(absoluteDirectoryName)).isDirectory() === false) {
        return next();
      }
    } catch (e) {
      return next();
    }

    try {
      const directory =
        await ObjectManagers.getInstance().GalleryManager.listDirectory(
          req.session.context,
          directoryName,
          parseInt(
            req.query[QueryParams.gallery.knownLastModified] as string,
            10
          ),
          parseInt(
            req.query[QueryParams.gallery.knownLastScanned] as string,
            10
          )
        );

      if (directory == null) {
        req.resultPipe = ContentWrapperUtils.build(null, null, true);
        return next();
      }
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
      const query: SearchQueryDTO = req.resultPipe as any;

      // Get all media items from search
      const searchResult = await ObjectManagers.getInstance().SearchManager.search(
        req.session.context, query);

      if (!searchResult.media || searchResult.media.length === 0) {
        return next(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'No media found for zip'));
      }

      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', 'attachment; filename=SearchResults.zip');

      const archive = archiver('zip', {
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
        if (usedNames.has(lowerName)) {
          const count = usedNames.get(lowerName) + 1;
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

    req.resultPipe = ContentWrapperUtils.pack(cw);

    return next();
  }

  public static async loadFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (!req.params['mediaPath']) {
      return next();
    }
    const fullMediaPath = path.join(
      ProjectPath.ImageFolder,
      req.params['mediaPath']
    );

    // check if file exist
    try {
      if ((await fsp.stat(fullMediaPath)).isDirectory()) {
        return next();
      }
    } catch (e) {
      return next(
        new ErrorDTO(
          ErrorCodes.PATH_ERROR,
          'no such file:' + req.params['mediaPath'],
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
    } catch (e) {
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

      const query: SearchQueryDTO = req.resultPipe as any;
      const result = await ObjectManagers.getInstance().SearchManager.search(
        req.session.context,
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
      if (!req.params['value']) {
        return next();
      }

      let type: SearchQueryTypes = SearchQueryTypes.any_text;
      if (req.query[QueryParams.gallery.search.type]) {
        type = parseInt(req.query[QueryParams.gallery.search.type] as string, 10);
      }
      req.resultPipe =
        await ObjectManagers.getInstance().SearchManager.autocomplete(
          req.session.context,
          req.params['value'],
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

      const query: SearchQueryDTO = req.resultPipe as any;

      const photos =
        await ObjectManagers.getInstance().SearchManager.getNMedia(
          req.session.context,
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
          'Can\'t get random photo: ' + e.toString()
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

      if (!req.params['mediaPath']) {
        return next();
      }
      const mediaPath = req.params['mediaPath'];

      req.resultPipe = await ObjectManagers.getInstance().GalleryManager.getMedia(req.session.context, mediaPath);
      return next();
    } catch (e) {
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Can\'t get random photo: ' + e.toString()
        )
      );
    }
  }
}
