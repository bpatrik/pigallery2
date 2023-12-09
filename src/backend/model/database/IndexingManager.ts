import {DirectoryBaseDTO, DirectoryDTOUtils, DirectoryPathDTO, ParentDirectoryDTO} from '../../../common/entities/DirectoryDTO';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {SQLConnection} from './SQLConnection';
import {PhotoEntity, PhotoMetadataEntity} from './enitites/PhotoEntity';
import {Utils} from '../../../common/Utils';
import {PhotoMetadata,} from '../../../common/entities/PhotoDTO';
import {Connection, ObjectLiteral, Repository} from 'typeorm';
import {MediaEntity} from './enitites/MediaEntity';
import {MediaDTO, MediaDTOUtils} from '../../../common/entities/MediaDTO';
import {VideoEntity} from './enitites/VideoEntity';
import {FileEntity} from './enitites/FileEntity';
import {FileDTO} from '../../../common/entities/FileDTO';
import {NotificationManager} from '../NotifocationManager';
import {ObjectManagers} from '../ObjectManagers';
import {Logger} from '../../Logger';
import {ServerPG2ConfMap, ServerSidePG2ConfAction,} from '../../../common/PG2ConfMap';
import {ProjectPath} from '../../ProjectPath';
import * as path from 'path';
import * as fs from 'fs';
import {SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';
import {PersonEntry} from './enitites/PersonEntry';
import {PersonJunctionTable} from './enitites/PersonJunctionTable';
import {MDFileEntity} from './enitites/MDFileEntity';
import {MDFileDTO} from '../../../common/entities/MDFileDTO';
import {DiskManager} from '../fileaccess/DiskManager';

const LOG_TAG = '[IndexingManager]';

export class IndexingManager {
  SavingReady: Promise<void> = null;
  private SavingReadyPR: () => void = null;
  private savingQueue: ParentDirectoryDTO[] = [];
  private isSaving = false;

  get IsSavingInProgress(): boolean {
    return this.SavingReady !== null;
  }

  private static async processServerSidePG2Conf(
    parent: DirectoryPathDTO,
    files: FileDTO[]
  ): Promise<void> {
    for (const f of files) {
      if (ServerPG2ConfMap[f.name] === ServerSidePG2ConfAction.SAVED_SEARCH) {
        const fullMediaPath = path.join(
          ProjectPath.ImageFolder,
          parent.path,
          parent.name,
          f.name
        );

        Logger.silly(
          LOG_TAG,
          'Saving saved-searches to DB from:',
          fullMediaPath
        );
        const savedSearches: { name: string; searchQuery: SearchQueryDTO }[] =
          JSON.parse(await fs.promises.readFile(fullMediaPath, 'utf8'));
        for (const s of savedSearches) {
          await ObjectManagers.getInstance().AlbumManager.addIfNotExistSavedSearch(
            s.name,
            s.searchQuery,
            true
          );
        }
      }
    }
  }

  /**
   * Indexes a dir, but returns early with the scanned version,
   * does not wait for the DB to be saved
   */
  public indexDirectory(
    relativeDirectoryName: string
  ): Promise<ParentDirectoryDTO> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject): Promise<void> => {
      try {
        // Check if root is still a valid (non-empty) folder
        // With weak devices it is possible that the media that stores
        // the galley gets unmounted that triggers a full gallery wipe.
        // Prevent it by stopping indexing on an empty folder.
        if (fs.readdirSync(ProjectPath.ImageFolder).length === 0) {
          return reject(new Error('Root directory is empty. This is probably error and would erase gallery database. Stopping indexing.'));
        }

        const scannedDirectory = await DiskManager.scanDirectory(
          relativeDirectoryName
        );


        const dirClone = Utils.clone(scannedDirectory);
        // filter server side only config from returning
        dirClone.metaFile = dirClone.metaFile.filter(
          (m) => !ServerPG2ConfMap[m.name]
        );

        DirectoryDTOUtils.addReferences(dirClone);
        resolve(dirClone);

        // save directory to DB
        this.queueForSave(scannedDirectory).catch(console.error);
      } catch (error) {
        NotificationManager.warning(
          'Unknown indexing error for: ' + relativeDirectoryName,
          error.toString()
        );
        console.error(error);
        return reject(error);
      }
    });
  }

  async resetDB(): Promise<void> {
    Logger.info(LOG_TAG, 'Resetting DB');
    const connection = await SQLConnection.getConnection();
    await connection
      .getRepository(DirectoryEntity)
      .createQueryBuilder('directory')
      .delete()
      .execute();
  }

  public async saveToDB(scannedDirectory: ParentDirectoryDTO): Promise<void> {
    this.isSaving = true;
    try {
      const connection = await SQLConnection.getConnection();
      const serverSideConfigs = scannedDirectory.metaFile.filter(
        (m) => !!ServerPG2ConfMap[m.name]
      );
      scannedDirectory.metaFile = scannedDirectory.metaFile.filter(
        (m) => !ServerPG2ConfMap[m.name]
      );
      const currentDirId: number = await this.saveParentDir(
        connection,
        scannedDirectory
      );
      await this.saveChildDirs(connection, currentDirId, scannedDirectory);
      await this.saveMedia(connection, currentDirId, scannedDirectory.media);
      await this.saveMetaFiles(connection, currentDirId, scannedDirectory);
      await IndexingManager.processServerSidePG2Conf(scannedDirectory, serverSideConfigs);
      await ObjectManagers.getInstance().onDataChange(scannedDirectory);
    } finally {
      this.isSaving = false;
    }
  }

  // Todo fix it, once typeorm support connection pools for sqlite
  /**
   * Queues up a directory to save to the DB.
   */
  protected async queueForSave(
    scannedDirectory: ParentDirectoryDTO
  ): Promise<void> {
    // Is this dir  already queued for saving?
    if (
      this.savingQueue.findIndex(
        (dir): boolean =>
          dir.name === scannedDirectory.name &&
          dir.path === scannedDirectory.path &&
          dir.lastModified === scannedDirectory.lastModified &&
          dir.lastScanned === scannedDirectory.lastScanned &&
          (dir.media || dir.media.length) ===
          (scannedDirectory.media || scannedDirectory.media.length) &&
          (dir.metaFile || dir.metaFile.length) ===
          (scannedDirectory.metaFile || scannedDirectory.metaFile.length)
      ) !== -1
    ) {
      return;
    }
    this.savingQueue.push(scannedDirectory);
    if (!this.SavingReady) {
      this.SavingReady = new Promise<void>((resolve): void => {
        this.SavingReadyPR = resolve;
      });
    }
    try {
      while (this.isSaving === false && this.savingQueue.length > 0) {
        await this.saveToDB(this.savingQueue[0]);
        this.savingQueue.shift();
      }
    } catch (e) {
      this.savingQueue = [];
      throw e;
    } finally {
      if (this.savingQueue.length === 0) {
        this.SavingReady = null;
        this.SavingReadyPR();
      }
    }
  }

  protected async saveParentDir(
    connection: Connection,
    scannedDirectory: ParentDirectoryDTO
  ): Promise<number> {
    const directoryRepository = connection.getRepository(DirectoryEntity);

    const currentDir: DirectoryEntity = await directoryRepository
      .createQueryBuilder('directory')
      .where('directory.name = :name AND directory.path = :path', {
        name: scannedDirectory.name,
        path: scannedDirectory.path,
      })
      .getOne();
    if (currentDir) {
      // Updated parent dir (if it was in the DB previously)
      currentDir.lastModified = scannedDirectory.lastModified;
      currentDir.lastScanned = scannedDirectory.lastScanned;
      currentDir.mediaCount = scannedDirectory.mediaCount;
      currentDir.youngestMedia = scannedDirectory.youngestMedia;
      currentDir.oldestMedia = scannedDirectory.oldestMedia;
      await directoryRepository.save(currentDir);
      return currentDir.id;
    } else {
      return (
        await directoryRepository.insert({
          mediaCount: scannedDirectory.mediaCount,
          lastModified: scannedDirectory.lastModified,
          lastScanned: scannedDirectory.lastScanned,
          youngestMedia: scannedDirectory.youngestMedia,
          oldestMedia: scannedDirectory.oldestMedia,
          name: scannedDirectory.name,
          path: scannedDirectory.path,
        } as DirectoryEntity)
      ).identifiers[0]['id'];
    }
  }

  protected async saveChildDirs(
    connection: Connection,
    currentDirId: number,
    scannedDirectory: ParentDirectoryDTO
  ): Promise<void> {
    const directoryRepository = connection.getRepository(DirectoryEntity);

    // update subdirectories that does not have a parent
    await directoryRepository
      .createQueryBuilder()
      .update(DirectoryEntity)
      .set({parent: currentDirId as unknown})
      .where('path = :path', {
        path: DiskManager.pathFromParent(scannedDirectory),
      })
      .andWhere('name NOT LIKE :root', {root: DiskManager.dirName('.')})
      .andWhere('parent IS NULL')
      .execute();

    // save subdirectories
    const childDirectories = await directoryRepository
      .createQueryBuilder('directory')
      .leftJoinAndSelect('directory.parent', 'parent')
      .where('directory.parent = :dir', {
        dir: currentDirId,
      })
      .getMany();

    for (const directory of scannedDirectory.directories) {
      // Was this child Dir already indexed before?
      const dirIndex = childDirectories.findIndex(
        (d): boolean => d.name === directory.name
      );

      if (dirIndex !== -1) {
        // directory found
        childDirectories.splice(dirIndex, 1);
      } else {
        // dir does not exist yet
        directory.parent = {id: currentDirId} as ParentDirectoryDTO;
        (directory as DirectoryEntity).lastScanned = null; // new child dir, not fully scanned yet
        const d = await directoryRepository.insert(
          directory as DirectoryEntity
        );

        await this.saveMedia(
          connection,
          d.identifiers[0]['id'],
          directory.media
        );
      }
    }

    // Remove child Dirs that are not anymore in the parent dir
    await directoryRepository.remove(childDirectories, {
      chunk: Math.max(Math.ceil(childDirectories.length / 500), 1),
    });
  }

  protected async saveMetaFiles(
    connection: Connection,
    currentDirID: number,
    scannedDirectory: ParentDirectoryDTO
  ): Promise<void> {
    const fileRepository = connection.getRepository(FileEntity);
    const MDfileRepository = connection.getRepository(MDFileEntity);
    // save files
    const indexedMetaFiles = await fileRepository
      .createQueryBuilder('file')
      .where('file.directory = :dir', {
        dir: currentDirID,
      })
      .getMany();

    const metaFilesToInsert = [];
    const MDFilesToUpdate = [];
    for (const item of scannedDirectory.metaFile) {
      let metaFile: FileDTO = null;
      for (let j = 0; j < indexedMetaFiles.length; j++) {
        if (indexedMetaFiles[j].name === item.name) {
          metaFile = indexedMetaFiles[j];
          indexedMetaFiles.splice(j, 1);
          break;
        }
      }
      if (metaFile == null) {
        // not in DB yet
        item.directory = null;
        metaFile = Utils.clone(item);
        item.directory = scannedDirectory;
        metaFile.directory = {id: currentDirID} as DirectoryBaseDTO;
        metaFilesToInsert.push(metaFile);
      } else if ((item as MDFileDTO).date) {
        if ((item as MDFileDTO).date != (metaFile as MDFileDTO).date) {
          (metaFile as MDFileDTO).date = (item as MDFileDTO).date;
          MDFilesToUpdate.push(metaFile);
        }
      }
    }

    const MDFiles = metaFilesToInsert.filter(f => !isNaN((f as MDFileDTO).date));
    const generalFiles = metaFilesToInsert.filter(f => isNaN((f as MDFileDTO).date));
    await fileRepository.save(generalFiles, {
      chunk: Math.max(Math.ceil(generalFiles.length / 500), 1),
    });
    await MDfileRepository.save(MDFiles, {
      chunk: Math.max(Math.ceil(MDFiles.length / 500), 1),
    });
    await MDfileRepository.save(MDFilesToUpdate, {
      chunk: Math.max(Math.ceil(MDFilesToUpdate.length / 500), 1),
    });
    await fileRepository.remove(indexedMetaFiles, {
      chunk: Math.max(Math.ceil(indexedMetaFiles.length / 500), 1),
    });
  }

  protected async saveMedia(
    connection: Connection,
    parentDirId: number,
    media: MediaDTO[]
  ): Promise<void> {
    const mediaRepository = connection.getRepository(MediaEntity);
    const photoRepository = connection.getRepository(PhotoEntity);
    const videoRepository = connection.getRepository(VideoEntity);
    // save media
    let indexedMedia = await mediaRepository
      .createQueryBuilder('media')
      .where('media.directory = :dir', {
        dir: parentDirId,
      })
      .getMany();

    const mediaChange = {
      saveP: [] as MediaDTO[], // save/update photo
      saveV: [] as MediaDTO[], // save/update video
      insertP: [] as MediaDTO[], // insert photo
      insertV: [] as MediaDTO[], // insert video
    };
    const personsPerPhoto: { faces: { name: string, mediaId?: number }[]; mediaName: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < media.length; i++) {
      let mediaItem: MediaDTO = null;
      for (let j = 0; j < indexedMedia.length; j++) {
        if (indexedMedia[j].name === media[i].name) {
          mediaItem = indexedMedia[j];
          indexedMedia.splice(j, 1);
          break;
        }
      }

      const scannedFaces: { name: string }[] = (media[i].metadata as PhotoMetadata).faces || [];
      if ((media[i].metadata as PhotoMetadata).faces) {
        // if it has faces, cache them
        // make the list distinct (some photos may contain the same person multiple times)
        (media[i].metadata as PhotoMetadataEntity).persons = [
          ...new Set(
            (media[i].metadata as PhotoMetadata).faces.map((f) => f.name)
          ),
        ];
      }
      (media[i].metadata as PhotoMetadataEntity).personsLength = (media[i].metadata as PhotoMetadataEntity)?.persons?.length || 0;


      if (mediaItem == null) {
        // Media not in DB yet
        media[i].directory = null;
        mediaItem = Utils.clone(media[i]);
        mediaItem.directory = {id: parentDirId} as DirectoryBaseDTO;
        (MediaDTOUtils.isPhoto(mediaItem)
            ? mediaChange.insertP
            : mediaChange.insertV
        ).push(mediaItem);
      } else {
        // Media already in the DB, only needs to be updated
        delete (mediaItem.metadata as PhotoMetadata).faces;
        if (!Utils.equalsFilter(mediaItem.metadata, media[i].metadata)) {
          mediaItem.metadata = media[i].metadata;
          (MediaDTOUtils.isPhoto(mediaItem)
              ? mediaChange.saveP
              : mediaChange.saveV
          ).push(mediaItem);
        }
      }

      personsPerPhoto.push({
        faces: scannedFaces,
        mediaName: mediaItem.name
      });
    }

    await this.saveChunk(photoRepository, mediaChange.saveP, 100);
    await this.saveChunk(videoRepository, mediaChange.saveV, 100);
    await this.saveChunk(photoRepository, mediaChange.insertP, 100);
    await this.saveChunk(videoRepository, mediaChange.insertV, 100);

    indexedMedia = await mediaRepository
      .createQueryBuilder('media')
      .where('media.directory = :dir', {
        dir: parentDirId,
      })
      .select(['media.name', 'media.id'])
      .getMany();

    const persons: { name: string; mediaId: number }[] = [];
    personsPerPhoto.forEach((group): void => {
      const mIndex = indexedMedia.findIndex(
        (m): boolean => m.name === group.mediaName
      );
      group.faces.forEach((sf) =>
        (sf.mediaId = indexedMedia[mIndex].id)
      );

      persons.push(...group.faces as { name: string; mediaId: number }[]);
      indexedMedia.splice(mIndex, 1);
    });

    await this.savePersonsToMedia(connection, parentDirId, persons);
    await mediaRepository.remove(indexedMedia);
  }

  protected async savePersonsToMedia(
    connection: Connection,
    parentDirId: number,
    scannedFaces: { name: string; mediaId: number }[]
  ): Promise<void> {
    const personJunctionTable = connection.getRepository(PersonJunctionTable);
    const personRepository = connection.getRepository(PersonEntry);

    const persons: { name: string; mediaId: number }[] = [];

    // Make a set
    for (const face of scannedFaces) {
      if (persons.findIndex((f) => f.name === face.name) === -1) {
        persons.push(face);
      }
    }
    await ObjectManagers.getInstance().PersonManager.saveAll(persons);
    // get saved persons without triggering denormalized data update (i.e.: do not use PersonManager.get).
    const savedPersons = await personRepository.find();

    const indexedFaces = await personJunctionTable
      .createQueryBuilder('face')
      .leftJoin('face.media', 'media')
      .where('media.directory = :directory', {
        directory: parentDirId,
      })
      .leftJoinAndSelect('face.person', 'person')
      .getMany();

    const faceToInsert: { person: { id: number }, media: { id: number } }[] = [];
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < scannedFaces.length; i++) {
      // was the Person - media connection already indexed
      let face: PersonJunctionTable = null;
      for (let j = 0; j < indexedFaces.length; j++) {
        if (indexedFaces[j].person.name === scannedFaces[i].name) {
          face = indexedFaces[j];
          indexedFaces.splice(j, 1);
          break; // region found, stop processing
        }
      }

      if (face == null) {
        faceToInsert.push({
          person: savedPersons.find(
            (p) => p.name === scannedFaces[i].name
          ),
          media: {id: scannedFaces[i].mediaId}
        });
      }
    }
    if (faceToInsert.length > 0) {
      await this.insertChunk(personJunctionTable, faceToInsert, 100);
    }
    await personJunctionTable.remove(indexedFaces, {
      chunk: Math.max(Math.ceil(indexedFaces.length / 500), 1),
    });
  }

  private async saveChunk<T extends ObjectLiteral>(
    repository: Repository<T>,
    entities: T[],
    size: number
  ): Promise<T[]> {
    if (entities.length === 0) {
      return [];
    }
    if (entities.length < size) {
      return await repository.save(entities);
    }
    let list: T[] = [];
    for (let i = 0; i < entities.length / size; i++) {
      list = list.concat(
        await repository.save(entities.slice(i * size, (i + 1) * size))
      );
    }
    return list;
  }

  private async insertChunk<T extends ObjectLiteral>(
    repository: Repository<T>,
    entities: T[],
    size: number
  ): Promise<number[]> {
    if (entities.length === 0) {
      return [];
    }
    if (entities.length < size) {
      return (await repository.insert(entities)).identifiers.map(
        (i: { id: number }) => i.id
      );
    }
    let list: number[] = [];
    for (let i = 0; i < entities.length / size; i++) {
      list = list.concat(
        (
          await repository.insert(entities.slice(i * size, (i + 1) * size))
        ).identifiers.map((ids) => ids['id'])
      );
    }
    return list;
  }
}
