import {promises as fsp, Stats} from 'fs';
import * as path from 'path';
import {DirectoryPathDTO, ParentDirectoryDTO, SubDirectoryDTO,} from '../../../common/entities/DirectoryDTO';
import {PhotoDTO} from '../../../common/entities/PhotoDTO';
import {ProjectPath} from '../../ProjectPath';
import {Config} from '../../../common/config/private/Config';
import {VideoDTO} from '../../../common/entities/VideoDTO';
import {FileDTO} from '../../../common/entities/FileDTO';
import {Logger} from '../../Logger';
import {VideoProcessing} from './fileprocessing/VideoProcessing';
import {PhotoProcessing} from './fileprocessing/PhotoProcessing';
import {Utils} from '../../../common/Utils';
import {GPXProcessing} from './fileprocessing/GPXProcessing';
import {MDFileDTO} from '../../../common/entities/MDFileDTO';
import {MetadataLoader} from './MetadataLoader';
import {NotificationManager} from '../NotifocationManager';
import {ExtensionDecorator} from '../extension/ExtensionDecorator';
import {SessionManager} from '../database/SessionManager';


const LOG_TAG = '[DiskManager]';
declare const global: { gc: () => void };

export class DiskManager {
  public static calcLastModified(stat: Stats): number {
    return Math.max(stat.ctime.getTime(), stat.mtime.getTime());
  }

  public static getDTOFromPath(relativeDirectoryName: string): DirectoryPathDTO {
    return {
      path: this.pathFromRelativeDirName(relativeDirectoryName),
      name: DiskManager.dirName(relativeDirectoryName)
    };
  }

  public static normalizeDirPath(dirPath: string): string {
    return path.normalize(path.join('.' + path.sep, dirPath));
  }

  public static pathFromRelativeDirName(relativeDirectoryName: string): string {
    return path.join(
      path.dirname(this.normalizeDirPath(relativeDirectoryName)),
      path.sep
    );
  }

  public static pathFromParent(parent: { path: string; name: string }): string {
    return path.join(
      this.normalizeDirPath(path.join(parent.path, parent.name)),
      path.sep
    );
  }

  public static dirName(dirPath: string): string {
    if (dirPath.trim().length === 0) {
      return '.';
    }
    return path.basename(dirPath);
  }

  @ExtensionDecorator(e => e.gallery.DiskManager.excludeDir)
  public static async excludeDir(dir: {
    name: string,
    parentDirRelativeName: string,
    parentDirAbsoluteName: string
  }): Promise<boolean> {
    if (
      Config.Indexing.excludeFolderList.length === 0 &&
      Config.Indexing.excludeFileList.length === 0
    ) {
      return false;
    }
    const absoluteName = path.normalize(path.join(dir.parentDirAbsoluteName, dir.name));
    const relativeName = path.normalize(path.join(dir.parentDirRelativeName, dir.name));

    for (const exclude of Config.Indexing.excludeFolderList) {
      if (exclude.startsWith('/')) {
        if (exclude === absoluteName) {
          return true;
        }
      } else if (exclude.includes('/')) {
        if (path.normalize(exclude) === relativeName) {
          return true;
        }
      } else {
        if (exclude === dir.name) {
          return true;
        }
      }
    }
    // exclude dirs that have the given files (like .ignore)
    for (const exclude of Config.Indexing.excludeFileList) {
      try {
        await fsp.access(path.join(absoluteName, exclude));
        return true;
      } catch (e) {
        // ignoring errors
      }
    }

    return false;
  }

  public static async scanDirectoryNoMetadata(
    relativeDirectoryName: string,
    settings: DirectoryScanSettings = {}
  ): Promise<ParentDirectoryDTO<FileDTO>> {
    settings.noMetadata = true;
    return (await this.scanDirectory(
      relativeDirectoryName,
      settings
    )) as ParentDirectoryDTO<FileDTO>;
  }

  @ExtensionDecorator(e => e.gallery.DiskManager.scanDirectory)
  public static async scanDirectory(
    relativeDirectoryName: string,
    settings: DirectoryScanSettings = {}
  ): Promise<ParentDirectoryDTO> {
    Logger.silly(LOG_TAG, 'scanning directory:', relativeDirectoryName);
    relativeDirectoryName = this.normalizeDirPath(relativeDirectoryName);
    const dto = this.getDTOFromPath(relativeDirectoryName);

    const absoluteDirectoryName = path.join(
      ProjectPath.ImageFolder,
      relativeDirectoryName
    );

    const stat = await fsp.stat(
      path.join(ProjectPath.ImageFolder, relativeDirectoryName)
    );
    const directory: ParentDirectoryDTO = {
      id: null,
      parent: null,
      name: dto.name,
      path: dto.path,
      lastModified: this.calcLastModified(stat),
      directories: [],
      isPartial: settings.coverOnly === true,
      media: [],
      metaFile: [],
      cache: {
        projectionKey: SessionManager.NO_PROJECTION_KEY,
        mediaCount: 0,
        cover: null,
        valid: false
      }
    };
    if (!settings.coverOnly) {
      directory.lastScanned = Date.now();
    }

    // nothing to scan, we are here for the empty dir
    if (
      settings.noPhoto === true &&
      settings.noMetaFile === true &&
      settings.noVideo === true
    ) {
      return directory;
    }
    const list = await fsp.readdir(absoluteDirectoryName);
    let count = 0;

    for (const file of list) {
      count++;

      if (count % 1000 === 0) {
        if (global.gc) {
          Logger.silly(LOG_TAG, 'Triggering gc after scanning ', count, ' files in dir: ', relativeDirectoryName);
          global.gc();
        }
      }
      const fullFilePath = path.normalize(
        path.join(absoluteDirectoryName, file)
      );
      if ((await fsp.stat(fullFilePath)).isDirectory()) {
        try {
          if (
            settings.noDirectory === true ||
            settings.coverOnly === true ||
            (await DiskManager.excludeDir({
              name: file,
              parentDirRelativeName: relativeDirectoryName,
              parentDirAbsoluteName: absoluteDirectoryName
            }))
          ) {
            continue;
          }

          // create cover directory
          const d = (await DiskManager.scanDirectory(
            path.join(relativeDirectoryName, file),
            {
              coverOnly: true,
            }
          )) as SubDirectoryDTO;

          directory.directories.push(d);
        } catch (err) {
          NotificationManager.warning(
            'Unknown directory reading error, skipping: ' + path.join(relativeDirectoryName, file),
            err.toString()
          );
          console.error(err);
        }
      } else if (PhotoProcessing.isPhoto(fullFilePath)) {
        try {
          if (settings.noPhoto === true) {
            continue;
          }

          const photo = {
            name: file,
            directory: null,
            metadata:
              settings.noMetadata === true
                ? null
                : await MetadataLoader.loadPhotoMetadata(fullFilePath),
          } as PhotoDTO;

          if (!directory.cache.cover) {
            directory.cache.cover = Utils.clone(photo);

            directory.cache.cover.directory = {
              path: directory.path,
              name: directory.name,
            };
          }
          // add the cover photo to the list of media, so it will be saved to the DB
          // and can be queried to populate covers,
          // otherwise we do not return media list that is only partial
          directory.media.push(photo);

          if (settings.coverOnly === true) {
            break;
          }
        } catch (err) {
          NotificationManager.warning('Media loading error, skipping: ' +
            fullFilePath +
            ', reason: ' +
            err.toString()
          );
          console.error(err);
        }
      } else if (VideoProcessing.isVideo(fullFilePath)) {
        try {
          if (
            Config.Media.Video.enabled === false ||
            settings.noVideo === true ||
            settings.coverOnly === true
          ) {
            continue;
          }
          directory.media.push({
            name: file,
            directory: null,
            metadata:
              settings.noMetadata === true
                ? null
                : await MetadataLoader.loadVideoMetadata(fullFilePath),
          } as VideoDTO);
        } catch (e) {
          Logger.warn(
            'Media loading error, skipping: ' +
            fullFilePath +
            ', reason: ' +
            e.toString()
          );
        }
      } else if (GPXProcessing.isMetaFile(fullFilePath)) {

        try {
          if (
            !DiskManager.isEnabledMetaFile(fullFilePath) ||
            settings.noMetaFile === true ||
            settings.coverOnly === true
          ) {
            continue;
          }

          directory.metaFile.push({
            name: file,
            directory: null,
          } as FileDTO);
        } catch (e) {
          Logger.warn(
            'Metafile loading error, skipping: ' +
            fullFilePath +
            ', reason: ' +
            e.toString()
          );
        }
      }
    }

    directory.cache.mediaCount = directory.media.length;
    // TODO: cache is now calculated purely though DB after indexing of the directory is done.
    // Delete is with caution (double check if it still indeed not used)
    if (!directory.isPartial && !settings.noMetadata) {
      directory.cache.youngestMedia = Number.MAX_SAFE_INTEGER;
      directory.cache.oldestMedia = Number.MIN_SAFE_INTEGER;

      directory.media.forEach((m) => {
          directory.cache.youngestMedia = Math.min(Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset), directory.cache.youngestMedia);
          directory.cache.oldestMedia = Math.max(Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset), directory.cache.oldestMedia);
        }
      );

      directory.metaFile.forEach(mf => {
        if (DiskManager.isMarkdown(mf.name)) {
          (mf as MDFileDTO).date = directory.cache.youngestMedia;
        }
      });
    }

    return directory;
  }


  private static isEnabledMetaFile(fullPath: string): boolean {
    const extension = path.extname(fullPath).toLowerCase();

    switch (extension) {
      case '.gpx':
        return Config.MetaFile.gpx;
      case '.md':
        return Config.MetaFile.markdown;
      case '.pg2conf':
        return Config.MetaFile.pg2conf;
    }

    return false;
  }

  private static isMarkdown(fullPath: string): boolean {
    const extension = path.extname(fullPath).toLowerCase();

    return extension == '.md';
  }
}

export interface DirectoryScanSettings {
  coverOnly?: boolean;
  noMetaFile?: boolean;
  noVideo?: boolean;
  noPhoto?: boolean;
  noDirectory?: boolean;
  noMetadata?: boolean; // skip parsing images for metadata like exif, iptc
  noChildDirPhotos?: boolean;
}
