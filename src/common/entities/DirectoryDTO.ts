import {MediaDTO} from './MediaDTO';
import {FileDTO} from './FileDTO';
import {CoverPhotoDTO} from './PhotoDTO';
import {Utils} from '../Utils';

export interface DirectoryPathDTO {
  name: string;
  path: string;
}

export interface DirectoryCacheDTO {
  id?: number;
  projectionKey?: string;
  directory?: DirectoryBaseDTO;
  mediaCount: number;
  recursiveMediaCount?: number;
  youngestMedia?: number;
  oldestMedia?: number;
  cover?: CoverPhotoDTO;
  valid?: boolean; // does not go to the client side
}

export interface DirectoryBaseDTO<S extends FileDTO = MediaDTO>
  extends DirectoryPathDTO {
  id: number;
  name: string;
  path: string;
  lastModified: number;
  lastScanned?: number;
  isPartial?: boolean;
  parent: DirectoryBaseDTO<S>;
  directories?: DirectoryBaseDTO<S>[];
  media?: S[];
  metaFile?: FileDTO[];
  cache?: DirectoryCacheDTO;
}

export interface ParentDirectoryDTO<S extends FileDTO = MediaDTO>
  extends DirectoryBaseDTO<S> {
  id: number;
  name: string;
  path: string;
  lastModified: number;
  lastScanned?: number;
  isPartial?: boolean;
  parent: ParentDirectoryDTO<S>;
  directories: SubDirectoryDTO<S>[];
  media: S[];
  metaFile: FileDTO[];
  cache?: DirectoryCacheDTO;
  // Which parent directories the user can open, starting from the root. If not set, all parents are available.
  // It travels as a bitmask over the network, see ContentWrapperUtils.
  availableParents?: boolean[];
}

export interface SubDirectoryDTO<S extends FileDTO = MediaDTO>
  extends DirectoryBaseDTO<S> {
  id: number;
  name: string;
  path: string;
  lastModified: number;
  lastScanned: number;
  isPartial?: boolean;
  parent: ParentDirectoryDTO<S>;
  cache?: DirectoryCacheDTO;
}

export const DirectoryDTOUtils = {
  addReferences: (dir: DirectoryBaseDTO): void => {
    dir.media.forEach((media: MediaDTO) => {
      media.directory = dir;
    });

    if (dir.metaFile) {
      dir.metaFile.forEach((file: FileDTO) => {
        file.directory = dir;
      });
    }

    if (dir.directories) {
      dir.directories.forEach((directory) => {
        DirectoryDTOUtils.addReferences(directory);
        directory.parent = dir;
      });
    }
  },

  removeReferences: (dir: DirectoryBaseDTO): DirectoryBaseDTO => {
    if (dir.cache?.cover) {
      dir.cache.cover.directory = {
        path: dir.cache.cover.directory.path,
        name: dir.cache.cover.directory.name,
      } as DirectoryPathDTO;

      // make sure that it is not a same object as one of the photo in the media[]
      // as the next foreach would remove the directory
      dir.cache.cover = Utils.clone(dir.cache.cover);
    }

    if (dir.media) {
      dir.media.forEach((media: MediaDTO) => {
        media.directory = null;
      });
    }

    if (dir.metaFile) {
      dir.metaFile.forEach((file: FileDTO) => {
        file.directory = null;
      });
    }
    if (dir.directories) {
      dir.directories.forEach((directory) => {
        DirectoryDTOUtils.removeReferences(directory);
        directory.parent = null;
      });
    }

    delete dir.cache.valid; // should not go to the client side;

    return dir;
  },
};
