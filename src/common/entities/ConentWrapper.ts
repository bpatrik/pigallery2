/* eslint-disable @typescript-eslint/ban-ts-comment */
import {DirectoryBaseDTO, DirectoryPathDTO, ParentDirectoryDTO} from './DirectoryDTO';
import {SearchResultDTO} from './SearchResultDTO';
import {Utils} from '../Utils';
import {MediaDTO, MediaDTOUtils} from './MediaDTO';
import {FileDTO} from './FileDTO';
import {VideoDTO} from './VideoDTO';
import {PhotoDTO} from './PhotoDTO';


export class ContentWrapper {
  private map?: {
    faces: string[],
    keywords: string[],
    lens: string[],
    camera: string[],
    directories: DirectoryPathDTO[]
  };
  private reverseMap?: {
    faces: Map<string, number>,
    keywords: Map<string, number>,
    lens: Map<string, number>,
    camera: Map<string, number>,
    directories: Map<string, number>
  };
  public directory: ParentDirectoryDTO;
  public searchResult: SearchResultDTO;
  public notModified?: boolean;

  constructor(
      directory: ParentDirectoryDTO = null,
      searchResult: SearchResultDTO = null,
      notModified?: boolean
  ) {
    if (directory) {
      this.directory = directory;
    }
    if (searchResult) {
      this.searchResult = searchResult;
    }
    if (notModified) {
      this.notModified = notModified;
    }
  }


  private static mapify(cw: ContentWrapper, media: FileDTO, isSearchResult: boolean): void {
    if (isSearchResult) {
      const k = JSON.stringify(media.directory);
      if (!cw.reverseMap.directories.has(k)) {
        cw.reverseMap.directories.set(k, cw.map.directories.length);
        cw.map.directories.push(media.directory);
      }
      // @ts-ignore
      media.d = cw.reverseMap.directories.get(k);
      delete media.directory;
    }


    // @ts-ignore
    (media as MediaDTO)['n'] = (media as MediaDTO).name;
    delete (media as MediaDTO).name;

    if (typeof (media as MediaDTO).missingThumbnails !== 'undefined') {
      // @ts-ignore
      (media as MediaDTO)['t'] = (media as MediaDTO).missingThumbnails;
      delete (media as MediaDTO).missingThumbnails;
    }

    if ((media as MediaDTO).metadata) {
      // @ts-ignore
      (media as MediaDTO).metadata['d'] = [(media as MediaDTO).metadata.size.width, (media as MediaDTO).metadata.size.height];
      delete (media as MediaDTO).metadata.size;
      // @ts-ignore
      (media as MediaDTO).metadata['s'] = (media as MediaDTO).metadata.fileSize;
      delete (media as MediaDTO).metadata.fileSize;

      // @ts-ignore
      (media as MediaDTO).metadata['t'] = (media as MediaDTO).metadata.creationDate / 1000; // skip millies
      delete (media as MediaDTO).metadata.creationDate;

      if ((media as MediaDTO).metadata.creationDateOffset) {
        // @ts-ignore
        (media as MediaDTO).metadata['o'] = Utils.getOffsetMinutes((media as MediaDTO).metadata.creationDateOffset); // offset in minutes
        delete (media as MediaDTO).metadata.creationDateOffset;
      }

      if ((media as PhotoDTO).metadata.rating) {
        // @ts-ignore
        (media as PhotoDTO).metadata['r'] = (media as PhotoDTO).metadata.rating;
        delete (media as PhotoDTO).metadata.rating;
      }
      if ((media as PhotoDTO).metadata.caption) {
        // @ts-ignore
        (media as PhotoDTO).metadata['a'] = (media as PhotoDTO).metadata.caption;
        delete (media as PhotoDTO).metadata.caption;
      }

      if ((media as PhotoDTO).metadata.faces) {
        for (let i = 0; i < (media as PhotoDTO).metadata.faces.length; ++i) {
          const name = (media as PhotoDTO).metadata.faces[i].name;
          if (!cw.reverseMap.faces.has(name)) {
            cw.reverseMap.faces.set(name, cw.map.faces.length);
            cw.map.faces.push(name);
          }
          // @ts-ignore
          (media as PhotoDTO).metadata.faces[i] = [...(media as PhotoDTO).metadata.faces[i].b, cw.reverseMap.faces.get(name)];
        }

        // @ts-ignore
        (media as PhotoDTO).metadata['f'] = (media as PhotoDTO).metadata.faces;
        delete (media as PhotoDTO).metadata.faces;
      }

      if ((media as PhotoDTO).metadata.keywords) {
        for (let i = 0; i < (media as PhotoDTO).metadata.keywords.length; ++i) {
          const k = (media as PhotoDTO).metadata.keywords[i];
          if (!cw.reverseMap.keywords.has(k)) {
            cw.reverseMap.keywords.set(k, cw.map.keywords.length);
            cw.map.keywords.push(k);
          }
          // @ts-ignore
          (media as PhotoDTO).metadata.keywords[i] = cw.reverseMap.keywords.get(k);
        }
        // @ts-ignore
        (media as PhotoDTO).metadata['k'] = (media as PhotoDTO).metadata.keywords;
        delete (media as PhotoDTO).metadata.keywords;
      }
      const mapifyOne = <T>(map: string[], reverseMap: Map<string, number>,
                            obj: T, key: keyof T, mappedKey: string) => {

        // @ts-ignore
        const k: string = obj[key];

        if (!reverseMap.has(k)) {
          reverseMap.set(k, map.length);
          map.push(k);
        }
        // @ts-ignore
        obj[mappedKey] = reverseMap.get(k);
        delete obj[key];
      };
      if ((media as PhotoDTO).metadata.cameraData) {
        if ((media as PhotoDTO).metadata.cameraData.lens) {
          mapifyOne(cw.map.lens, cw.reverseMap.lens,
              (media as PhotoDTO).metadata.cameraData, 'lens', 'l');
        }
        if ((media as PhotoDTO).metadata.cameraData.make) {
          mapifyOne(cw.map.camera, cw.reverseMap.camera,
              (media as PhotoDTO).metadata.cameraData, 'make', 'm');
        }
        if ((media as PhotoDTO).metadata.cameraData.model) {
          mapifyOne(cw.map.camera, cw.reverseMap.camera,
              (media as PhotoDTO).metadata.cameraData, 'model', 'o');
        }

        if ((media as PhotoDTO).metadata.cameraData.ISO) {
          // @ts-ignore
          (media as PhotoDTO).metadata.cameraData['i'] = (media as PhotoDTO).metadata.cameraData.ISO;
          delete (media as PhotoDTO).metadata.cameraData.ISO;
        }
        if ((media as PhotoDTO).metadata.cameraData.fStop) {
          // @ts-ignore
          (media as PhotoDTO).metadata.cameraData['s'] = (media as PhotoDTO).metadata.cameraData.fStop;
          delete (media as PhotoDTO).metadata.cameraData.fStop;
        }
        if ((media as PhotoDTO).metadata.cameraData.exposure) {
          // @ts-ignore
          (media as PhotoDTO).metadata.cameraData['e'] = (media as PhotoDTO).metadata.cameraData.exposure;
          delete (media as PhotoDTO).metadata.cameraData.exposure;
        }
        if ((media as PhotoDTO).metadata.cameraData.focalLength) {
          // @ts-ignore
          (media as PhotoDTO).metadata.cameraData['a'] = (media as PhotoDTO).metadata.cameraData.focalLength;
          delete (media as PhotoDTO).metadata.cameraData.focalLength;
        }

        // @ts-ignore
        (media as PhotoDTO).metadata['c'] = (media as PhotoDTO).metadata.cameraData;
        delete (media as PhotoDTO).metadata.cameraData;
      }
      if ((media as PhotoDTO).metadata.positionData) {
        if ((media as PhotoDTO).metadata.positionData.country) {
          mapifyOne(cw.map.keywords, cw.reverseMap.keywords,
              (media as PhotoDTO).metadata.positionData, 'country', 'c');
        }
        if ((media as PhotoDTO).metadata.positionData.city) {
          mapifyOne(cw.map.keywords, cw.reverseMap.keywords,
              (media as PhotoDTO).metadata.positionData, 'city', 'cy');
        }
        if ((media as PhotoDTO).metadata.positionData.state) {
          mapifyOne(cw.map.keywords, cw.reverseMap.keywords,
              (media as PhotoDTO).metadata.positionData, 'state', 's');
        }

        if ((media as PhotoDTO).metadata.positionData.GPSData) {
          // @ts-ignore
          (media as PhotoDTO).metadata.positionData['g'] = [(media as PhotoDTO).metadata.positionData.GPSData.latitude, (media as PhotoDTO).metadata.positionData.GPSData.longitude];
          delete (media as PhotoDTO).metadata.positionData.GPSData;
        }
        // @ts-ignore
        (media as PhotoDTO).metadata['p'] = (media as PhotoDTO).metadata.positionData;
        delete (media as PhotoDTO).metadata.positionData;
      }

      // @ts-ignore
      (media as PhotoDTO)['m'] = (media as PhotoDTO).metadata;
      delete (media as PhotoDTO).metadata;
    }

  }

  private static packMedia(cw: ContentWrapper, media: MediaDTO[], isSearchResult: boolean): void {

    // clean up media
    for (let i = 0; i < media.length; ++i) {
      const m = media[i];
      delete m.id;

      if (m.directory) {
        if (isSearchResult) {
          // keep the directory for search result
          delete (m.directory as DirectoryBaseDTO).id;
        } else {
          // for gallery listing, photos belong to one directory,
          // this can be deleted as the directory know its child
          delete m.directory;
        }
      }

      if (MediaDTOUtils.isPhoto(m)) {
        delete (m as VideoDTO).metadata.bitRate;
        delete (m as VideoDTO).metadata.duration;

        // compress faces
        if ((m as PhotoDTO).metadata.faces) {
          for (let j = 0; j < (m as PhotoDTO).metadata.faces.length; ++j) {
            const f = (m as PhotoDTO).metadata.faces[j];
            // @ts-ignore
            f['b'] = [f.box.top, f.box.left, f.box.height, f.box.width];
            delete f.box;
          }
        }
        ContentWrapper.mapify(cw, m, isSearchResult);
      } else if (MediaDTOUtils.isVideo(m)) {
        delete (m as PhotoDTO).metadata.caption;
        delete (m as PhotoDTO).metadata.cameraData;
        delete (m as PhotoDTO).metadata.faces;
        delete (m as PhotoDTO).metadata.positionData;
        ContentWrapper.mapify(cw, m, isSearchResult);
      }
      Utils.removeNullOrEmptyObj(m);
    }
  }

  private static packDirectory(cw: ContentWrapper, dir: DirectoryBaseDTO | SearchResultDTO, isSearchResult = false): void {
    if ((dir as DirectoryBaseDTO).cover) {
      (dir as DirectoryBaseDTO).cover.directory = {
        path: (dir as DirectoryBaseDTO).cover.directory.path,
        name: (dir as DirectoryBaseDTO).cover.directory.name,
      } as DirectoryPathDTO;

      // make sure that it is not a same object as one of the photo in the media[]
      // as the next foreach would remove the directory
      (dir as DirectoryBaseDTO).cover = Utils.clone((dir as DirectoryBaseDTO).cover);
    }

    if (dir.media) {
      ContentWrapper.packMedia(cw, dir.media, isSearchResult);
    }

    if (dir.metaFile) {
      for (let i = 0; i < dir.metaFile.length; ++i) {
        if (isSearchResult) {
          delete (dir.metaFile[i].directory as DirectoryBaseDTO).id;
        } else {
          delete dir.metaFile[i].directory;
        }
        delete dir.metaFile[i].id;
        ContentWrapper.mapify(cw, dir.metaFile[i], isSearchResult);
      }
    }
    if (dir.directories) {
      for (let i = 0; i < dir.directories.length; ++i) {
        ContentWrapper.packDirectory(cw, dir.directories[i]);
        delete dir.directories[i].parent;
      }
    }

    delete (dir as DirectoryBaseDTO).validCover; // should not go to the client side;
  }

  private static deMapify(cw: ContentWrapper, media: FileDTO, isSearchResult: boolean): void {

    const deMapifyOne = <T>(map: any[],
                            obj: T, key: keyof T, mappedKey: string) => {
      // @ts-ignore
      obj[key] = map[obj[mappedKey]];
      // @ts-ignore
      delete obj[mappedKey];
    };
    if (isSearchResult) {
      deMapifyOne(cw.map.directories, media, 'directory', 'd');
    }

    // @ts-ignore
    if ((media as MediaDTO)['n']) {
      // @ts-ignore
      (media as PhotoDTO).name = (media as PhotoDTO)['n'];
      // @ts-ignore
      delete (media as PhotoDTO)['n'];
    }
    // @ts-ignore
    if ((media as MediaDTO)['t']) {
      // @ts-ignore
      (media as PhotoDTO).missingThumbnails = (media as PhotoDTO)['t'];
      // @ts-ignore
      delete (media as PhotoDTO)['t'];
    }

    // @ts-ignore
    if ((media as MediaDTO)['m']) {
      // @ts-ignore
      (media as PhotoDTO).metadata = (media as PhotoDTO)['m'];
      // @ts-ignore
      delete (media as PhotoDTO)['m'];

      (media as MediaDTO).metadata.size = {
        // @ts-ignore
        width: (media as MediaDTO).metadata['d'][0],
        // @ts-ignore
        height: (media as MediaDTO).metadata['d'][1],
      };
      // @ts-ignore
      delete (media as MediaDTO).metadata['d'];


      // @ts-ignore
      if (typeof (media as PhotoDTO).metadata['t'] !== 'undefined') {
        // @ts-ignore
        (media as PhotoDTO).metadata.creationDate = (media as PhotoDTO).metadata['t'] * 1000;
        // @ts-ignore
        delete (media as PhotoDTO).metadata['t'];
      }

      // @ts-ignore
      if (typeof (media as PhotoDTO).metadata['o'] !== 'undefined') {
        // @ts-ignore
        (media as PhotoDTO).metadata.creationDateOffset = Utils.getOffsetString((media as PhotoDTO).metadata['o']) ;//convert offset from minutes to String
        // @ts-ignore
        delete (media as PhotoDTO).metadata['o'];
      }

      // @ts-ignore
      if (typeof (media as PhotoDTO).metadata['r'] !== 'undefined') {
        // @ts-ignore
        (media as PhotoDTO).metadata.rating = (media as PhotoDTO).metadata['r'];
        // @ts-ignore
        delete (media as PhotoDTO).metadata['r'];
      }

      // @ts-ignore
      if (typeof (media as PhotoDTO).metadata['a'] !== 'undefined') {
        // @ts-ignore
        (media as PhotoDTO).metadata.caption = (media as PhotoDTO).metadata['a'];
        // @ts-ignore
        delete (media as PhotoDTO).metadata['a'];
      }

      // @ts-ignore
      (media as PhotoDTO).metadata.fileSize = (media as PhotoDTO).metadata['s'];
      // @ts-ignore
      delete (media as PhotoDTO).metadata['s'];


      // @ts-ignore
      if ((media as PhotoDTO).metadata['f']) {
        // @ts-ignore
        (media as PhotoDTO).metadata.faces = (media as PhotoDTO).metadata['f'];
        // @ts-ignore
        delete (media as PhotoDTO).metadata['f'];
        for (let j = 0; j < (media as PhotoDTO).metadata.faces.length; ++j) {
          // @ts-ignore
          const boxArr: number[] = (media as PhotoDTO).metadata.faces[j];
          (media as PhotoDTO).metadata.faces[j] = {
            box: {
              top: boxArr[0],
              left: boxArr[1],
              height: boxArr[2],
              width: boxArr[3],
            },
            // @ts-ignore
            name: boxArr[4]
          };
        }

        for (let i = 0; i < (media as PhotoDTO).metadata.faces.length; ++i) {
          // @ts-ignore
          (media as PhotoDTO).metadata.faces[i].name = cw.map.faces[(media as PhotoDTO).metadata.faces[i].name];

        }

      }
      // @ts-ignore
      if ((media as PhotoDTO).metadata['k']) {

        // @ts-ignore
        (media as PhotoDTO).metadata.keywords = (media as PhotoDTO).metadata['k'];
        // @ts-ignore
        delete (media as PhotoDTO).metadata['k'];
        for (let i = 0; i < (media as PhotoDTO).metadata.keywords.length; ++i) {
          // @ts-ignore
          (media as PhotoDTO).metadata.keywords[i] = cw.map.keywords[(media as PhotoDTO).metadata.keywords[i]];
        }
      }
      // @ts-ignore
      if ((media as PhotoDTO).metadata['c']) {
        // @ts-ignore
        (media as PhotoDTO).metadata.cameraData = (media as PhotoDTO).metadata.c;
        // @ts-ignore
        delete (media as PhotoDTO).metadata.c;

        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.cameraData.l !== 'undefined') {
          deMapifyOne(cw.map.lens,
              (media as PhotoDTO).metadata.cameraData, 'lens', 'l');
        }
        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.cameraData.m !== 'undefined') {
          deMapifyOne(cw.map.camera,
              (media as PhotoDTO).metadata.cameraData, 'make', 'm');
        }
        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.cameraData['o'] !== 'undefined') {
          deMapifyOne(cw.map.camera,
              (media as PhotoDTO).metadata.cameraData, 'model', 'o');
        }

        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.cameraData['i'] !== 'undefined') {
          // @ts-ignore
          (media as PhotoDTO).metadata.cameraData.ISO = (media as PhotoDTO).metadata.cameraData['i'];
          // @ts-ignore
          delete (media as PhotoDTO).metadata.cameraData['i'];
        }
        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.cameraData['a'] !== 'undefined') {
          // @ts-ignore
          (media as PhotoDTO).metadata.cameraData.focalLength = (media as PhotoDTO).metadata.cameraData['a'];
          // @ts-ignore
          delete (media as PhotoDTO).metadata.cameraData['a'];
        }
        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.cameraData['e'] !== 'undefined') {
          // @ts-ignore
          (media as PhotoDTO).metadata.cameraData.exposure = (media as PhotoDTO).metadata.cameraData['e'];
          // @ts-ignore
          delete (media as PhotoDTO).metadata.cameraData['e'];
        }
        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.cameraData['s'] !== 'undefined') {
          // @ts-ignore
          (media as PhotoDTO).metadata.cameraData.fStop = (media as PhotoDTO).metadata.cameraData['s'];
          // @ts-ignore
          delete (media as PhotoDTO).metadata.cameraData['s'];
        }

      }
      // @ts-ignore
      if ((media as PhotoDTO).metadata['p']) {
        // @ts-ignore
        (media as PhotoDTO).metadata.positionData = (media as PhotoDTO).metadata.p;
        // @ts-ignore
        delete (media as PhotoDTO).metadata.p;
        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.positionData.c !== 'undefined') {
          deMapifyOne(cw.map.keywords,
              (media as PhotoDTO).metadata.positionData, 'country', 'c');
        }
        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.positionData.cy !== 'undefined') {
          deMapifyOne(cw.map.keywords,
              (media as PhotoDTO).metadata.positionData, 'city', 'cy');
        }
        // @ts-ignore
        if (typeof (media as PhotoDTO).metadata.positionData.s !== 'undefined') {
          deMapifyOne(cw.map.keywords,
              (media as PhotoDTO).metadata.positionData, 'state', 's');
        }

        // @ts-ignore
        if ((media as PhotoDTO).metadata.positionData['g']) {
          (media as PhotoDTO).metadata.positionData.GPSData =
              {
                // @ts-ignore
                latitude: (media as PhotoDTO).metadata.positionData['g'][0],
                // @ts-ignore
                longitude: (media as PhotoDTO).metadata.positionData['g'][1]
              };
          // @ts-ignore
          delete (media as PhotoDTO).metadata.positionData['g'];
        }
      }
    }

  }

  private static unPackMedia(cw: ContentWrapper, dir: DirectoryBaseDTO, media: MediaDTO[], isSearchResult: boolean): void {
// clean up media
    for (let i = 0; i < media.length; ++i) {
      const m = media[i];

      ContentWrapper.deMapify(cw, m, isSearchResult);

      if (!isSearchResult) {
        m.directory = dir;
      }
    }
  }

  private static unPackDirectory(cw: ContentWrapper, dir: DirectoryBaseDTO | SearchResultDTO, isSearchResult = false): void {
    if (dir.media) {
      ContentWrapper.unPackMedia(cw, dir as DirectoryBaseDTO, dir.media, isSearchResult);
    }

    if (dir.metaFile) {
      for (let i = 0; i < dir.metaFile.length; ++i) {
        if (!isSearchResult) {
          dir.metaFile[i].directory = dir as DirectoryBaseDTO;
        }
        ContentWrapper.deMapify(cw, dir.metaFile[i], isSearchResult);
      }
    }
    if (dir.directories) {
      for (let i = 0; i < dir.directories.length; ++i) {
        ContentWrapper.unPackDirectory(cw, dir.directories[i]);
        if (!isSearchResult) {
          dir.directories[i].parent = dir as DirectoryBaseDTO;
        }
      }
    }

  }

  static pack(cw: ContentWrapper): ContentWrapper {

    // init CW for packing
    cw.map = {
      faces: [], keywords: [], lens: [],
      camera: [], directories: []
    };
    cw.reverseMap = {
      faces: new Map(), keywords: new Map(),
      lens: new Map(), camera: new Map(), directories: new Map()
    };

    if (cw.directory) {
      ContentWrapper.packDirectory(cw, cw.directory);
    } else if (cw.searchResult) {
      ContentWrapper.packDirectory(cw, cw.searchResult, true);
    }

    // remove empty maps
    for (const k in cw.map) {
      // @ts-ignore
      if (cw.map[k].length === 0) {
        // @ts-ignore
        delete cw.map[k];
      }
    }

    delete cw.reverseMap;
    return cw;

  }

  static unpack(cw: ContentWrapper): ContentWrapper {
    if (!cw || cw.notModified) {
      return cw;
    }
    if (cw.directory) {
      ContentWrapper.unPackDirectory(cw, cw.directory);
    } else if (cw.searchResult) {
      ContentWrapper.unPackDirectory(cw, cw.searchResult, true);
    }
    delete cw.map;
    return cw;
  }
}
