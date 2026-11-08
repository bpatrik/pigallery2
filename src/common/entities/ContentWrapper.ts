import {DirectoryBaseDTO, DirectoryPathDTO, ParentDirectoryDTO} from './DirectoryDTO';
import {SearchResultDTO} from './SearchResultDTO';
import {Utils} from '../Utils';
import {LiveVideoInfo, MediaDimension, MediaDTO, MediaDTOUtils, RatingTypes} from './MediaDTO';
import {FaceRegionBox, GPSMetadata} from './PhotoDTO';
import {FileDTO} from './FileDTO';


export interface ContentWrapper {
  directory?: ParentDirectoryDTO | null;
  searchResult?: SearchResultDTO | null;
  notModified?: boolean;
}

export interface PackedContentWrapper {
  directory?: ParentDirectoryDTO | null;
  searchResult?: SearchResultDTO | null;
  notModified?: boolean;
  map: {
    faces: string[],
    keywords: string[],
    lens: string[],
    camera: string[],
    directories: DirectoryPathDTO[]
  };
  // temporal field
  reverseMap?: {
    faces: Map<string, number>,
    keywords: Map<string, number>,
    lens: Map<string, number>,
    camera: Map<string, number>,
    directories: Map<string, number>
  };
}


export interface ContentWrapperWithError extends ContentWrapper {
  error?: string;
}

export interface PackedContentWrapperWithError extends PackedContentWrapper {
  error?: string;
}

/**
 * The packer renames and drops the fields of the DTOs in place.
 * The interfaces below list both the DTO and the packed field names of each level,
 * so the same object can be read before and after a field is renamed.
 * Map fields (e.g. `l` of the camera) hold the index of the value in PackedContentWrapper.map.
 */
interface PackedFace {
  name: string;
  box?: FaceRegionBox;
  b?: number[]; // [top, left, height, width]
}

interface PackedCameraData {
  lens?: string;
  l?: number;
  make?: string;
  m?: number;
  model?: string;
  o?: number;
  ISO?: number;
  i?: number;
  fStop?: number;
  s?: number;
  exposure?: number;
  e?: number;
  focalLength?: number;
  a?: number;
}

interface PackedPositionData {
  country?: string;
  c?: number;
  city?: string;
  cy?: number;
  state?: string;
  s?: number;
  GPSData?: GPSMetadata;
  g?: (number | undefined)[]; // [latitude, longitude]
}

interface PackedMetadata {
  size?: MediaDimension;
  d?: number[]; // [width, height]
  fileSize?: number;
  s?: number;
  creationDate?: number;
  t?: number; // in seconds
  creationDateOffset?: string;
  o?: number; // in minutes
  rating?: RatingTypes;
  r?: RatingTypes;
  caption?: string;
  a?: string;
  faces?: PackedFace[];
  f?: number[][]; // [...box, name]
  keywords?: string[];
  k?: number[];
  cameraData?: PackedCameraData;
  c?: PackedCameraData;
  positionData?: PackedPositionData;
  p?: PackedPositionData;
  // video only, dropped from photos
  bitRate?: number | null;
  duration?: number;
}

interface PackedFile {
  id?: number;
  directory?: DirectoryPathDTO & { id?: number };
  d?: number;
  name?: string;
  n?: string;
  missingThumbnails?: number;
  t?: number;
  liveVideoPath?: string;
  l?: string;
  liveVideoInfo?: LiveVideoInfo;
  li?: LiveVideoInfo;
  metadata?: PackedMetadata;
  m?: PackedMetadata;
}

interface PackedDirectory {
  parent?: unknown;
  cache?: {
    id?: number;
    projectionKey?: string;
    directory?: unknown;
    valid?: boolean;
    cover?: { id?: number; directory: DirectoryPathDTO } | null;
  };
  media?: MediaDTO[];
  metaFile?: PackedFile[];
  directories?: PackedDirectory[];
}

/**
 * Index of the value in the map, adds it if it is not there yet
 */
const toIndex = (map: string[], reverseMap: Map<string, number>, value: string): number => {
  let index = reverseMap.get(value);
  if (index === undefined) {
    index = map.length;
    reverseMap.set(value, index);
    map.push(value);
  }
  return index;
};

export class ContentWrapperUtils {
  // the list length marker bit also needs to fit into a safe integer (2^53)
  public static readonly MAX_BITMASK_LENGTH = 52;

  static equals(cw1: ContentWrapper, cw2: ContentWrapper): boolean {
    if (cw1 === cw2) {
      console.log('the same objects');
      return true;
    }

    if (!cw1 || !cw2) {
      return false;
    }

    if (cw1.notModified !== cw2.notModified) {
      return false;
    }

    if (cw1.directory && !ContentWrapperUtils.equalsPartialDirectory(cw1.directory, cw2.directory)) {
      return false;
    }
    const c1 = cw1.directory || cw1.searchResult;
    const c2 = cw2.directory || cw2.searchResult;
    if (c1 === c2) {
      return true;
    }

    if (!c1 || !c2) {
      return false;
    }
    if (!this.equalsDirectories(c1.directories, c2.directories)) {
      return false;
    }
    if (!this.equalsFiles(c1.media, c2.media)) {
      return false;
    }
    if (!this.equalsFiles(c1.metaFile, c2.metaFile)) {
      return false;
    }

    return true;
  }

  static equalsMedia(d1: FileDTO | null | undefined, d2: FileDTO | null | undefined): boolean {
    if (d1 === d2) {
      return true;
    }
    if (!d1 || !d2) {
      return false;
    }
    const {directory: m1dir, ...pm1} = d1;
    const {directory: m2dir, ...pm2} = d2;

    if (m1dir.name !== m2dir.name || m1dir.path !== m2dir.path) {
      return false;
    }

    // equalsFilter only checks the properties of its second argument: compare
    // both ways, so a removed property (e.g. the last keyword) is noticed too.
    if (!Utils.equalsFilter(pm1, pm2) || !Utils.equalsFilter(pm2, pm1)) {
      return false;
    }

    return true;


  }

  static equalsPartialDirectory(d1: DirectoryBaseDTO | null | undefined, d2: DirectoryBaseDTO | null | undefined): boolean {
    if (d1 === d2) {
      return true;
    }
    if (!d1 || !d2) {
      return false;
    }

    if (!ContentWrapperUtils.equalsMedia(d1.cache?.cover, d2.cache?.cover)) {
      return false;
    }

    const {cover: d1cover, ...d1c} = d1.cache ?? {};
    const {cover: d2cover, ...d2c} = d2.cache ?? {};

    if (!Utils.equalsFilter(d1c, d2c)) {
      return false;
    }

    const {parent: d1parent, directories: d1directories, media: d1media, metaFile: d1metaFile, cache: d1cache, ...pd1} = d1;
    const {parent: d2parent, directories: d2directories, media: d2media, metaFile: d2metaFile, cache: d2cache, ...pd2} = d2;

    if (!Utils.equalsFilter(pd1, pd2)) {
      return false;
    }

    return true;

  }

  static equalsDirectories(d1: DirectoryBaseDTO[], d2: DirectoryBaseDTO[]): boolean {
    if (d1 === d2) {
      return true;
    }
    if (!d1 || !d2) {
      return false;
    }
    if (d1.length !== d2.length) {
      return false;
    }

    const fullPath = (d: DirectoryBaseDTO) => d.path + '/' + d.name;

    const d1c = d1.slice().sort((a, b) => fullPath(a).localeCompare(fullPath(b)));
    const d2c = d2.slice().sort((a, b) => fullPath(a).localeCompare(fullPath(b)));
    for (let i = 0; i < d1.length; ++i) {
      if (ContentWrapperUtils.equalsPartialDirectory(d1c[i], d2c[i]) === false) {
        return false;
      }
    }
    return true;
  }

  static equalsFiles(m1: FileDTO[], m2: FileDTO[]): boolean {
    if (m1 === m2) {
      return true;
    }
    if (!m1 || !m2) {
      return false;
    }

    if (m1.length !== m2.length) {
      return false;
    }

    const fullPath = (m: FileDTO) => m.directory.path + '/' + m.directory.name + '/' + m.name;
    const m1c = m1.slice().sort((a, b) => fullPath(a).localeCompare(fullPath(b)));
    const m2c = m2.slice().sort((a, b) => fullPath(a).localeCompare(fullPath(b)));

    for (let i = 0; i < m1.length; ++i) {
      if (!ContentWrapperUtils.equalsMedia(m1c[i], m2c[i])) {
        return false;
      }
    }
    return true;
  }


  /**
   * Encodes a boolean list to a number: bit i is the i-th element, with an extra 1 bit above the last element
   * to keep the length of the list (e.g.: [true, false] -> 0b101).
   * Returns null if the list is too long to be stored in a safe integer.
   */
  static booleansToBitmask(list: boolean[]): number | null {
    if (list.length > ContentWrapperUtils.MAX_BITMASK_LENGTH) {
      return null;
    }
    let mask = Math.pow(2, list.length); // length marker. Bitwise operators are 32 bit only
    for (let i = 0; i < list.length; ++i) {
      if (list[i]) {
        mask += Math.pow(2, i);
      }
    }
    return mask;
  }

  static bitmaskToBooleans(mask: number): boolean[] {
    const list: boolean[] = [];
    while (mask > 1) {
      list.push(mask % 2 === 1);
      mask = Math.floor(mask / 2);
    }
    return list;
  }

  /**
   * availableParents travels as a bitmask over the network
   */
  private static packAvailableParents(dir: ParentDirectoryDTO): void {
    if (!Array.isArray(dir.availableParents)) {
      return;
    }
    const mask = ContentWrapperUtils.booleansToBitmask(dir.availableParents);
    if (mask !== null) {
      (dir as unknown as { availableParents: number }).availableParents = mask;
    }
  }

  private static unPackAvailableParents(dir: ParentDirectoryDTO): void {
    const packed = (dir as unknown as { availableParents: number | boolean[] }).availableParents;
    if (typeof packed === 'number') {
      dir.availableParents = ContentWrapperUtils.bitmaskToBooleans(packed);
    }
  }

  static pack(cwIn: ContentWrapper): PackedContentWrapper {
    const cw: PackedContentWrapper = {
      map: {
        faces: [], keywords: [], lens: [],
        camera: [], directories: []
      },
      reverseMap: {
        faces: new Map(), keywords: new Map(),
        lens: new Map(), camera: new Map(), directories: new Map()
      },
      ...cwIn
    };

    if (cw?.directory) {
      ContentWrapperUtils.packDirectory(cw, cw.directory);
      ContentWrapperUtils.packAvailableParents(cw.directory);
    } else if (cw.searchResult) {
      ContentWrapperUtils.packDirectory(cw, cw.searchResult, true);
    }

    // remove empty maps
    const map = cw.map as Partial<PackedContentWrapper['map']>;
    for (const k of Object.keys(map) as (keyof PackedContentWrapper['map'])[]) {
      if (map[k]?.length === 0) {
        delete map[k];
      }
    }

    delete cw.reverseMap;
    return cw;

  }

  static unpack(cwIn: PackedContentWrapper | null): ContentWrapper {
    const cw = {...cwIn} as PackedContentWrapper;
    if (!cw || cw.notModified) {
      return cw;
    }
    if (cw?.directory) {
      ContentWrapperUtils.unPackDirectory(cw, cw.directory);
      ContentWrapperUtils.unPackAvailableParents(cw.directory);
    } else if (cw.searchResult) {
      ContentWrapperUtils.unPackDirectory(cw, cw.searchResult, true);
    }
    delete (cw as Partial<PackedContentWrapper>).map;
    return cw;
  }

  public static build(
    directory: ParentDirectoryDTO | null = null,
    searchResult: SearchResultDTO | null = null,
    notModified?: boolean
  ) {
    const cw: ContentWrapper = {
      ...(directory && {directory}),
      ...(searchResult && {searchResult}),
      ...(notModified && {notModified}),
    };
    return cw;
  }


  private static mapify(cw: PackedContentWrapper, media: PackedFile, isSearchResult: boolean): void {
    const reverseMap = cw.reverseMap!; // pack() sets it for the time of packing
    if (isSearchResult) {
      const k = JSON.stringify(media.directory);
      if (!reverseMap.directories.has(k)) {
        reverseMap.directories.set(k, cw.map.directories.length);
        cw.map.directories.push(media.directory!);
      }
      media.d = reverseMap.directories.get(k);
      delete media.directory;
    }


    media.n = media.name;
    delete media.name;

    if (typeof media.missingThumbnails !== 'undefined') {
      media.t = media.missingThumbnails;
      delete media.missingThumbnails;
    }

    if (typeof media.liveVideoPath !== 'undefined') {
      media.l = media.liveVideoPath;
      delete media.liveVideoPath;
    }

    if (typeof media.liveVideoInfo !== 'undefined') {
      media.li = media.liveVideoInfo;
      delete media.liveVideoInfo;
    }

    if (media.metadata) {
      const metadata = media.metadata;
      metadata.d = [metadata.size!.width, metadata.size!.height];
      delete metadata.size;
      metadata.s = metadata.fileSize;
      delete metadata.fileSize;

      metadata.t = metadata.creationDate! / 1000; // skip millies
      delete metadata.creationDate;

      if (metadata.creationDateOffset) {
        metadata.o = Utils.getOffsetMinutes(metadata.creationDateOffset); // offset in minutes
        delete metadata.creationDateOffset;
      }

      if (metadata.rating) {
        metadata.r = metadata.rating;
        delete metadata.rating;
      }
      if (metadata.caption) {
        metadata.a = metadata.caption;
        delete metadata.caption;
      }

      if (metadata.faces) {
        metadata.f = metadata.faces.map(face => [...face.b!, toIndex(cw.map.faces, reverseMap.faces, face.name)]);
        delete metadata.faces;
      }

      if (metadata.keywords) {
        metadata.k = metadata.keywords.map(k => toIndex(cw.map.keywords, reverseMap.keywords, k));
        delete metadata.keywords;
      }
      if (metadata.cameraData) {
        const cameraData = metadata.cameraData;
        if (cameraData.lens) {
          cameraData.l = toIndex(cw.map.lens, reverseMap.lens, cameraData.lens);
          delete cameraData.lens;
        }
        if (cameraData.make) {
          cameraData.m = toIndex(cw.map.camera, reverseMap.camera, cameraData.make);
          delete cameraData.make;
        }
        if (cameraData.model) {
          cameraData.o = toIndex(cw.map.camera, reverseMap.camera, cameraData.model);
          delete cameraData.model;
        }

        if (cameraData.ISO) {
          cameraData.i = cameraData.ISO;
          delete cameraData.ISO;
        }
        if (cameraData.fStop) {
          cameraData.s = cameraData.fStop;
          delete cameraData.fStop;
        }
        if (cameraData.exposure) {
          cameraData.e = cameraData.exposure;
          delete cameraData.exposure;
        }
        if (cameraData.focalLength) {
          cameraData.a = cameraData.focalLength;
          delete cameraData.focalLength;
        }

        metadata.c = cameraData;
        delete metadata.cameraData;
      }
      if (metadata.positionData) {
        const positionData = metadata.positionData;
        if (positionData.country) {
          positionData.c = toIndex(cw.map.keywords, reverseMap.keywords, positionData.country);
          delete positionData.country;
        }
        if (positionData.city) {
          positionData.cy = toIndex(cw.map.keywords, reverseMap.keywords, positionData.city);
          delete positionData.city;
        }
        if (positionData.state) {
          positionData.s = toIndex(cw.map.keywords, reverseMap.keywords, positionData.state);
          delete positionData.state;
        }

        if (positionData.GPSData) {
          positionData.g = [positionData.GPSData.latitude, positionData.GPSData.longitude];
          delete positionData.GPSData;
        }
        metadata.p = positionData;
        delete metadata.positionData;
      }

      media.m = metadata;
      delete media.metadata;
    }

  }

  private static packMedia(cw: PackedContentWrapper, media: MediaDTO[], isSearchResult: boolean): void {

    // clean up media
    for (let i = 0; i < media.length; ++i) {
      const m = media[i] as PackedFile;
      const metadata: PackedMetadata = media[i].metadata;
      delete m.id;

      if (m.directory) {
        if (isSearchResult) {
          // keep the directory for search result
          m.directory = {
            path: m.directory.path,
            name: m.directory.name,
          };
        } else {
          // for gallery listing, photos belong to one directory,
          // this can be deleted as the directory know its child
          delete m.directory;
        }
      }

      if (MediaDTOUtils.isPhoto(media[i])) {
        delete metadata.bitRate;
        delete metadata.duration;

        // compress faces
        if (metadata.faces) {
          for (const f of metadata.faces) {
            f.b = [f.box!.top, f.box!.left, f.box!.height, f.box!.width];
            delete f.box;
          }
        }
        ContentWrapperUtils.mapify(cw, m, isSearchResult);
      } else if (MediaDTOUtils.isVideo(media[i])) {
        delete metadata.caption;
        delete metadata.cameraData;
        delete metadata.faces;
        delete metadata.positionData;
        ContentWrapperUtils.mapify(cw, m, isSearchResult);
      }
      Utils.removeNullOrEmptyObj(m);
    }
  }

  private static packDirectory(cw: PackedContentWrapper, dirIn: DirectoryBaseDTO | SearchResultDTO, isSearchResult = false): void {
    const dir = dirIn as PackedDirectory;
    if (dir.cache?.cover) {
      dir.cache.cover.directory = {
        path: dir.cache.cover.directory.path,
        name: dir.cache.cover.directory.name,
      };

      // make sure that it is a different object as one of the photo in the media[]
      // as the next foreach would remove the directory
      dir.cache.cover = Utils.clone(dir.cache.cover);
    }

    if (dir.media) {
      ContentWrapperUtils.packMedia(cw, dir.media, isSearchResult);
    }

    if (dir.metaFile) {
      for (const metaFile of dir.metaFile) {
        if (isSearchResult) {
          delete metaFile.directory!.id;
        } else {
          delete metaFile.directory;
        }
        delete metaFile.id;
        ContentWrapperUtils.mapify(cw, metaFile, isSearchResult);
      }
    }
    if (dir.directories) {
      for (const subDir of dir.directories) {
        // first remove the parent otherwise it will be a infinite recursion
        delete subDir.parent;
        ContentWrapperUtils.packDirectory(cw, subDir as DirectoryBaseDTO);
      }
    }

    // should not go to the client side
    delete dir.cache?.directory; // client know its directory
    delete dir.cache?.cover?.id;
    delete dir.cache?.id;
    delete dir.cache?.projectionKey; // client already knows its projectionKey
    delete dir.cache?.valid;

    Utils.removeNullOrEmptyObj(dir);
  }

  private static deMapify(cw: PackedContentWrapper, media: PackedFile, isSearchResult: boolean): void {
    if (isSearchResult) {
      media.directory = cw.map.directories[media.d!];
      delete media.d;
    }

    if (media.n) {
      media.name = media.n;
      delete media.n;
    }
    if (media.t) {
      media.missingThumbnails = media.t;
      delete media.t;
    }
    if (media.l) {
      media.liveVideoPath = media.l;
      delete media.l;
    }
    if (media.li) {
      media.liveVideoInfo = media.li;
      delete media.li;
    }

    if (media.m) {
      const metadata = media.m;
      media.metadata = metadata;
      delete media.m;

      metadata.size = {
        width: metadata.d![0],
        height: metadata.d![1],
      };
      delete metadata.d;


      if (typeof metadata.t !== 'undefined') {
        metadata.creationDate = metadata.t * 1000;
        delete metadata.t;
      }

      if (typeof metadata.o !== 'undefined') {
        metadata.creationDateOffset = Utils.getOffsetString(metadata.o);//convert offset from minutes to String
        delete metadata.o;
      }

      if (typeof metadata.r !== 'undefined') {
        metadata.rating = metadata.r;
        delete metadata.r;
      }

      if (typeof metadata.a !== 'undefined') {
        metadata.caption = metadata.a;
        delete metadata.a;
      }

      metadata.fileSize = metadata.s;
      delete metadata.s;


      if (metadata.f) {
        metadata.faces = metadata.f.map(boxArr => ({
          box: {
            top: boxArr[0],
            left: boxArr[1],
            height: boxArr[2],
            width: boxArr[3],
          },
          name: cw.map.faces[boxArr[4]]
        }));
        delete metadata.f;
      }
      if (metadata.k) {
        metadata.keywords = metadata.k.map(k => cw.map.keywords[k]);
        delete metadata.k;
      }
      if (metadata.c) {
        const cameraData = metadata.c;
        metadata.cameraData = cameraData;
        delete metadata.c;

        if (typeof cameraData.l !== 'undefined') {
          cameraData.lens = cw.map.lens[cameraData.l];
          delete cameraData.l;
        }
        if (typeof cameraData.m !== 'undefined') {
          cameraData.make = cw.map.camera[cameraData.m];
          delete cameraData.m;
        }
        if (typeof cameraData.o !== 'undefined') {
          cameraData.model = cw.map.camera[cameraData.o];
          delete cameraData.o;
        }

        if (typeof cameraData.i !== 'undefined') {
          cameraData.ISO = cameraData.i;
          delete cameraData.i;
        }
        if (typeof cameraData.a !== 'undefined') {
          cameraData.focalLength = cameraData.a;
          delete cameraData.a;
        }
        if (typeof cameraData.e !== 'undefined') {
          cameraData.exposure = cameraData.e;
          delete cameraData.e;
        }
        if (typeof cameraData.s !== 'undefined') {
          cameraData.fStop = cameraData.s;
          delete cameraData.s;
        }

      }
      if (metadata.p) {
        const positionData = metadata.p;
        metadata.positionData = positionData;
        delete metadata.p;
        if (typeof positionData.c !== 'undefined') {
          positionData.country = cw.map.keywords[positionData.c];
          delete positionData.c;
        }
        if (typeof positionData.cy !== 'undefined') {
          positionData.city = cw.map.keywords[positionData.cy];
          delete positionData.cy;
        }
        if (typeof positionData.s !== 'undefined') {
          positionData.state = cw.map.keywords[positionData.s];
          delete positionData.s;
        }

        if (positionData.g) {
          positionData.GPSData =
            {
              latitude: positionData.g[0],
              longitude: positionData.g[1]
            };
          delete positionData.g;
        }
      }
    }

  }

  private static unPackMedia(cw: PackedContentWrapper, dir: DirectoryBaseDTO, media: MediaDTO[], isSearchResult: boolean): void {
// clean up media
    for (let i = 0; i < media.length; ++i) {
      const m = media[i];

      ContentWrapperUtils.deMapify(cw, m, isSearchResult);

      if (!isSearchResult) {
        m.directory = dir;
      }
    }
  }

  private static unPackDirectory(cw: PackedContentWrapper, dir: DirectoryBaseDTO | SearchResultDTO, isSearchResult = false): void {
    if (dir.media) {
      ContentWrapperUtils.unPackMedia(cw, dir as DirectoryBaseDTO, dir.media, isSearchResult);
    }

    if (dir.metaFile) {
      for (let i = 0; i < dir.metaFile.length; ++i) {
        if (!isSearchResult) {
          dir.metaFile[i].directory = dir as DirectoryBaseDTO;
        }
        ContentWrapperUtils.deMapify(cw, dir.metaFile[i], isSearchResult);
      }
    }
    if (dir.directories) {
      for (let i = 0; i < dir.directories.length; ++i) {
        ContentWrapperUtils.unPackDirectory(cw, dir.directories[i]);
        if (!isSearchResult) {
          dir.directories[i].parent = dir as DirectoryBaseDTO;
        }
      }
    }

  }
}
