import {
  CameraMetadataEntity,
  GPSMetadataEntity,
  MediaDimensionEntity,
  PositionMetaDataEntity
} from '../src/backend/model/database/enitites/MediaEntity';
import {PhotoEntity, PhotoMetadataEntity} from '../src/backend/model/database/enitites/PhotoEntity';
import {DirectoryEntity} from '../src/backend/model/database/enitites/DirectoryEntity';
import {VideoEntity, VideoMetadataEntity} from '../src/backend/model/database/enitites/VideoEntity';
import {MediaDimension, MediaDTO, RatingTypes} from '../src/common/entities/MediaDTO';
import {
  CameraMetadata,
  CoverPhotoDTO,
  FaceRegion,
  GPSMetadata,
  PhotoDTO,
  PhotoMetadata,
  PositionMetaData
} from '../src/common/entities/PhotoDTO';
import {DirectoryBaseDTO, DirectoryPathDTO} from '../src/common/entities/DirectoryDTO';
import {FileDTO} from '../src/common/entities/FileDTO';
import {DiskManager} from '../src/backend/model/fileaccess/DiskManager';
import * as path from 'path';
import {Config} from '../src/common/config/private/Config';
import {SortByTypes} from '../src/common/entities/SortingMethods';

export class TestHelper {

  static creationCounter = 0;

  public static readonly TMP_DIR = path.join(__dirname, './tmp');

  public static getDirectoryEntry(parent: DirectoryBaseDTO = null, name = '.'): DirectoryEntity {

    const dir = new DirectoryEntity();
    dir.name = name;
    dir.path = DiskManager.pathFromParent({path: '', name: '.'});
    dir.cache = {mediaCount: 0, youngestMedia: 10, oldestMedia: 1000} as never;
    dir.directories = [];
    dir.metaFile = [];
    dir.media = [];
    dir.lastModified = 1656069687773;
    dir.lastScanned = 1656069687773;
    // dir.parent = null;
    if (parent !== null) {
      dir.path = DiskManager.pathFromParent(parent);
      parent.directories.push(dir);
    }
    return dir;
  }


  public static getBasePhotoEntry(dir: DirectoryPathDTO, name = 'base media.jpg'): PhotoEntity {
    const sd = new MediaDimensionEntity();
    sd.height = 400;
    sd.width = 200;
    const m = new PhotoMetadataEntity();
    m.caption = null;
    m.size = sd;
    m.creationDate = 1656069387772;
    m.creationDateOffset = '+02:00';
    m.fileSize = 123456789;
    // m.rating = 0; no rating by default

    // TODO: remove when typeorm is fixed
    m.duration = null;
    m.bitRate = null;


    const d = new PhotoEntity();
    d.name = name;
    d.directory = (dir as any);
    if ((dir as DirectoryBaseDTO).media) {
      (dir as DirectoryBaseDTO).media.push(d);
      (dir as DirectoryBaseDTO).cache.mediaCount++;
    }
    d.metadata = m;
    return d;
  }

  public static getPhotoEntry(dir: DirectoryPathDTO): PhotoEntity {
    const sd = new MediaDimensionEntity();
    sd.height = 400;
    sd.width = 200;
    const gps = new GPSMetadataEntity();
    gps.latitude = 1;
    gps.longitude = 1;
    const pd = new PositionMetaDataEntity();
    pd.city = 'New York';
    pd.country = 'Alderan';
    pd.state = 'Kamino';
    pd.GPSData = gps;
    const cd = new CameraMetadataEntity();
    cd.ISO = 100;
    cd.model = '60D';
    cd.make = 'Canon';
    cd.fStop = 1;
    cd.exposure = 1;
    cd.focalLength = 1;
    cd.lens = 'Lens';
    const m = new PhotoMetadataEntity();
    m.caption = null;
    m.keywords = ['apple'];
    m.cameraData = cd;
    m.positionData = pd;
    m.size = sd;
    m.creationDate = 1656069387772;
    m.creationDateOffset = '-05:00';
    m.fileSize = 123456789;
    // m.rating = 0; no rating by default

    // TODO: remove when typeorm is fixed
    m.duration = null;
    m.bitRate = null;


    const d = new PhotoEntity();
    d.name = 'test media.jpg';
    d.directory = (dir as any);
    if ((dir as DirectoryBaseDTO).media) {
      (dir as DirectoryBaseDTO).media.push(d);
      (dir as DirectoryBaseDTO).cache.mediaCount++;
    }
    d.metadata = m;
    return d;
  }

  public static getVideoEntry(dir: DirectoryPathDTO): VideoEntity {
    const sd = new MediaDimensionEntity();
    sd.height = 200;
    sd.width = 300;

    const m = new VideoMetadataEntity();
    m.caption = null;
    m.keywords = null;
    m.rating = null;
    m.size = sd;
    m.creationDate = 1656069387771;
    m.fileSize = 123456789;

    m.duration = 10000;
    m.bitRate = 4000;


    const d = new VideoEntity();
    d.name = 'test video.mp4';
    d.directory = (dir as any);
    if ((dir as DirectoryBaseDTO).media) {
      (dir as DirectoryBaseDTO).media.push(d);
      (dir as DirectoryBaseDTO).cache.mediaCount++;
    }
    d.metadata = m;
    return d;
  }

  public static getGPXEntry(dir: DirectoryPathDTO): FileDTO {
    const d: FileDTO = {
      id: null,
      name: 'saturdayRun.gpx',
      directory: dir
    };
    if ((dir as DirectoryBaseDTO).metaFile) {
      (dir as DirectoryBaseDTO).metaFile.push(d);
    }
    return d;
  }

  public static getVideoEntry1(dir: DirectoryBaseDTO): VideoEntity {
    const p = TestHelper.getVideoEntry(dir);
    p.name = 'swVideo.mp4';
    return p;
  }

  public static getPhotoEntry1(dir: DirectoryPathDTO): PhotoEntity {
    const p = TestHelper.getPhotoEntry(dir);

    p.metadata.caption = 'Han Solo\'s dice';
    p.metadata.keywords = ['Boba Fett', 'star wars', 'Anakin', 'death star', 'phantom menace'];
    p.metadata.positionData.city = 'Mos Eisley';
    p.metadata.positionData.country = 'Tatooine';
    p.name = 'sw1.jpg';
    p.metadata.positionData.GPSData.latitude = 10;
    p.metadata.positionData.GPSData.longitude = 10;
    p.metadata.creationDate = 1656069387772 - 1000;
    p.metadata.creationDateOffset = '+00:00';
    p.metadata.rating = 1;
    p.metadata.size.height = 1000;
    p.metadata.size.width = 1000;

    p.metadata.faces = [{
      box: {height: 10, width: 10, left: 10, top: 10},
      name: 'Boba Fett'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 102, top: 102},
      name: 'Luke Skywalker'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 103, top: 103},
      name: 'Han Solo'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 101, top: 101},
      name: 'Anakin Skywalker'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 104, top: 104},
      name: 'Unkle Ben'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 201, top: 201},
      name: 'R2-D2'
    } as FaceRegion] as any[];
    return p;
  }

  public static getPhotoEntry2(dir: DirectoryPathDTO): PhotoEntity {
    const p = TestHelper.getPhotoEntry(dir);

    p.metadata.caption = 'Light saber';
    p.metadata.title = 'Shuttle';
    p.metadata.keywords = ['Padmé Amidala', 'star wars', 'Natalie Portman', 'death star', 'wookiee'];
    p.metadata.positionData.city = 'Derem City';
    p.metadata.positionData.state = 'Research City';
    p.metadata.positionData.country = 'Kamino';
    p.name = 'sw2.jpg';
    p.metadata.positionData.GPSData.latitude = -10;
    p.metadata.positionData.GPSData.longitude = -10;
    p.metadata.creationDate = 1656069387772 - 2000;
    p.metadata.creationDateOffset = '+11:00';
    p.metadata.rating = 2;
    p.metadata.size.height = 2000;
    p.metadata.size.width = 1000;

    p.metadata.faces = [{
      box: {height: 10, width: 10, left: 10, top: 10},
      name: 'Padmé Amidala'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 101, top: 101},
      name: 'Anakin Skywalker'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 101, top: 101},
      name: 'Obivan Kenobi'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 201, top: 201},
      name: 'R2-D2'
    } as FaceRegion] as any[];
    return p;
  }

  public static getPhotoEntry3(dir: DirectoryPathDTO): PhotoEntity {
    const p = TestHelper.getPhotoEntry(dir);

    p.metadata.caption = 'Amber stone';
    p.metadata.keywords = ['star wars', 'wookiees'];
    p.metadata.positionData.city = 'Castilon';
    p.metadata.positionData.state = 'Devaron';
    p.metadata.positionData.country = 'Ajan Kloss';
    p.name = 'sw3.jpg';
    p.metadata.positionData.GPSData.latitude = 10;
    p.metadata.positionData.GPSData.longitude = 15;
    p.metadata.creationDate = 1656069387772 - 3000;
    p.metadata.creationDateOffset = '-03:45';
    p.metadata.rating = 3;
    p.metadata.size.height = 1000;
    p.metadata.size.width = 2000;
    p.metadata.faces = [{
      box: {height: 10, width: 10, left: 10, top: 10},
      name: 'Kylo Ren'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 101, top: 101},
      name: 'Leia Organa'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 103, top: 103},
      name: 'Han Solo'
    } as FaceRegion] as any[];
    return p;
  }

  public static getPhotoEntry4(dir: DirectoryPathDTO): PhotoEntity {
    const p = TestHelper.getPhotoEntry(dir);

    p.metadata.caption = 'Millennium falcon';
    p.metadata.keywords = ['star wars', 'ewoks'];
    p.metadata.positionData.city = 'Tipoca City';
    p.metadata.positionData.state = 'Exegol';
    p.metadata.positionData.country = 'Jedha';
    p.name = 'sw4.jpg';
    p.metadata.positionData.GPSData.latitude = 15;
    p.metadata.positionData.GPSData.longitude = 10;
    p.metadata.creationDate = 1656069387772 - 4000;
    p.metadata.creationDateOffset = '+04:30';
    p.metadata.size.height = 3000;
    p.metadata.size.width = 2000;

    p.metadata.faces = [{
      box: {height: 10, width: 10, left: 10, top: 10},
      name: 'Kylo Ren'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 101, top: 101},
      name: 'Anakin Skywalker'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 101, top: 101},
      name: 'Obivan Kenobi'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 201, top: 201},
      name: 'R2-D2'
    } as FaceRegion] as any[];

    return p;
  }

  public static getRandomizedDirectoryEntry(parent: DirectoryBaseDTO = null, forceStr: string = null): DirectoryBaseDTO<MediaDTO> {

    const dir: DirectoryBaseDTO = {
      id: null,
      name: DiskManager.dirName(forceStr || Math.random().toString(36).substring(7)),
      path: DiskManager.pathFromParent({path: '', name: '.'}),
      cache: {
        mediaCount: 0,
        recursiveMediaCount: 0,
        cover: null,
        valid: false,
      },
      directories: [],
      metaFile: [],
      media: [],
      lastModified: Date.now(),
      lastScanned: null,
      parent
    };
    if (parent !== null) {
      dir.path = DiskManager.pathFromParent(parent);
      parent.directories.push(dir);
    }
    return dir;
  }

  public static getRandomizedGPXEntry(dir: DirectoryBaseDTO, forceStr: string = null): FileDTO {
    const d: FileDTO = {
      id: null,
      name: forceStr + '_' + Math.random().toString(36).substring(7) + '.gpx',
      directory: dir
    };
    dir.metaFile.push(d);
    return d;
  }

  public static getRandomizedFace(media: PhotoDTO, forceStr: string = null): FaceRegion {
    const rndStr = (): string => {
      return forceStr + '_' + Math.random().toString(36).substring(7);
    };

    const rndInt = (max = 5000): number => {
      return Math.floor(Math.random() * max);
    };

    const f: FaceRegion = {
      name: rndStr() + '.jpg',
      box: {
        left: rndInt(),
        top: rndInt(),
        width: rndInt(),
        height: rndInt()
      }
    };
    media.metadata.faces = (media.metadata.faces || []);
    media.metadata.faces.push(f);
    return f;
  }

  public static getRandomizedPhotoEntry(dir: DirectoryBaseDTO, forceStr: string = null, faces = 2, rating?: RatingTypes): PhotoDTO {


    const rndStr = (): string => {
      return forceStr + '_' + Math.random().toString(36).substring(7);
    };

    const rndInt = (max = 5000): number => {
      return Math.floor(Math.random() * max);
    };

    const sd: MediaDimension = {
      height: rndInt(),
      width: rndInt(),
    };

    const gps: GPSMetadata = {
      latitude: rndInt(1000),
      longitude: rndInt(1000)
    };
    const pd: PositionMetaData = {
      city: rndStr(),
      country: rndStr(),
      state: rndStr(),
      GPSData: gps
    };
    const cd: CameraMetadata = {
      ISO: rndInt(500),
      model: rndStr(),
      make: rndStr(),
      fStop: rndInt(10),
      exposure: rndInt(10),
      focalLength: rndInt(10),
      lens: rndStr()
    };
    const m: PhotoMetadata = {
      keywords: [rndStr(), rndStr()],
      cameraData: cd,
      positionData: pd,
      size: sd,
      creationDate: Date.now() + ++TestHelper.creationCounter * (1000 * 60 * 10),
      creationDateOffset: '+01:00',
      fileSize: rndInt(10000),
      caption: rndStr(),
      ...(!isNaN(rating) && {rating})
    };


    const p: PhotoDTO = {
      id: null,
      name: rndStr() + '.jpg',
      directory: dir,
      metadata: m
    };

    for (let i = 0; i < faces; i++) {
      this.getRandomizedFace(p, 'Person ' + i);
    }

    dir.media.push(p);
    TestHelper.updateDirCache(dir);
    return p;
  }

  static updateDirCache(dir: DirectoryBaseDTO): void {
    // Ensure back-references are intact (removeReferences() may null them)
    dir.media.forEach((m) => (m.directory = dir));

    // Sort media by creation time (newest first) for cache boundaries
    const sortedByDate = dir.media
      .slice()
      .sort((a, b): number => b.metadata.creationDate - a.metadata.creationDate);

    // Build candidate list for album cover
    // Prefer media from this directory; otherwise, use covers from subdirectories
    const mediaForCover: CoverPhotoDTO[] =
      dir.media.length > 0
        ? (dir.media as CoverPhotoDTO[]).slice()
        : dir.directories
          .filter((d): boolean => !!d.cache?.cover)
          .map((d): CoverPhotoDTO => {
            // Make sure cover has correct directory reference
            d.cache.cover.directory = d;
            return d.cache.cover;
          });

    // Sort cover candidates by configured method
    const sortBy = Config.AlbumCover.Sorting[0].method;
    mediaForCover.sort((a, b): number =>
      sortBy == SortByTypes.Rating
        ? (b.metadata.rating || 0) - (a.metadata.rating || 0)
        : b.metadata.creationDate - a.metadata.creationDate
    );
    const cover = mediaForCover?.[0] || null;

    // Update directory cache
    if (dir.cache) {
      dir.cache.mediaCount = sortedByDate.length;
      dir.cache.recursiveMediaCount = dir.directories.reduce((acc, d) => acc + d.cache.mediaCount, 0) + sortedByDate.length;
      if (sortedByDate.length > 0) {
        dir.cache.youngestMedia = sortedByDate[0].metadata.creationDate;
        dir.cache.oldestMedia = sortedByDate[sortedByDate.length - 1].metadata.creationDate;
      }
      if (cover) {
        dir.cache.cover = cover;
      }
      dir.cache.valid = true;
    }

    // Propagate cache update upward
    if (dir.parent) {
      TestHelper.updateDirCache(dir.parent);
    }
  }


}
