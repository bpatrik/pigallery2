import {MediaDimensionEntity} from '../../../../../src/backend/model/database/sql/enitites/MediaEntity';
import {
  CameraMetadataEntity,
  GPSMetadataEntity,
  PhotoEntity,
  PhotoMetadataEntity,
  PositionMetaDataEntity
} from '../../../../../src/backend/model/database/sql/enitites/PhotoEntity';
import {DirectoryEntity} from '../../../../../src/backend/model/database/sql/enitites/DirectoryEntity';
import {VideoEntity, VideoMetadataEntity} from '../../../../../src/backend/model/database/sql/enitites/VideoEntity';
import {MediaDimension, MediaDTO} from '../../../../../src/common/entities/MediaDTO';
import {
  CameraMetadata,
  FaceRegion,
  GPSMetadata,
  PhotoDTO,
  PhotoMetadata,
  PositionMetaData,
  PreviewPhotoDTO,
  OrientationTypes
} from '../../../../../src/common/entities/PhotoDTO';
import {DirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {FileDTO} from '../../../../../src/common/entities/FileDTO';
import {DiskMangerWorker} from '../../../../../src/backend/model/threading/DiskMangerWorker';

export class TestHelper {

  static creationCounter = 0;

  public static getDirectoryEntry(parent: DirectoryDTO = null, name = 'wars dir'): DirectoryEntity {

    const dir = new DirectoryEntity();
    dir.name = name;
    dir.path = DiskMangerWorker.pathFromParent({path: '', name: '.'});
    dir.mediaCount = 0;
    dir.directories = [];
    dir.metaFile = [];
    dir.media = [];
    dir.lastModified = Date.now();
    dir.lastScanned = Date.now();
    // dir.parent = null;
    if (parent !== null) {
      dir.path = DiskMangerWorker.pathFromParent(parent);
      parent.directories.push(dir);
    }
    return dir;
  }

  public static getPhotoEntry(dir: DirectoryDTO): PhotoEntity {
    const sd = new MediaDimensionEntity();
    sd.height = 200;
    sd.width = 200;
    const gps = new GPSMetadataEntity();
    gps.altitude = 1;
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
    m.creationDate = Date.now();
    m.fileSize = 123456789;
    m.orientation = OrientationTypes.TOP_LEFT;
    // m.rating = 0; no rating by default

    // TODO: remove when typeorm is fixed
    m.duration = null;
    m.bitRate = null;


    const d = new PhotoEntity();
    d.name = 'test media.jpg';
    d.directory = (dir as any);
    dir.media.push(d);
    d.metadata = m;
    dir.mediaCount++;
    return d;
  }

  public static getVideoEntry(dir: DirectoryDTO): VideoEntity {
    const sd = new MediaDimensionEntity();
    sd.height = 200;
    sd.width = 200;

    const m = new VideoMetadataEntity();
    m.caption = null;
    m.keywords = null;
    m.rating = null;
    m.size = sd;
    m.creationDate = Date.now();
    m.fileSize = 123456789;

    m.duration = 10000;
    m.bitRate = 4000;


    const d = new VideoEntity();
    d.name = 'test video.mp4';
    dir.media.push(d);
    d.metadata = m;
    return d;
  }

  public static getVideoEntry1(dir: DirectoryDTO): VideoEntity {
    const p = TestHelper.getVideoEntry(dir);
    p.name = 'swVideo.mp4';
    return p;
  }

  public static getPhotoEntry1(dir: DirectoryDTO): PhotoEntity {
    const p = TestHelper.getPhotoEntry(dir);

    p.metadata.caption = 'Han Solo\'s dice';
    p.metadata.keywords = ['Boba Fett', 'star wars', 'Anakin', 'death star'];
    p.metadata.positionData.city = 'Mos Eisley';
    p.metadata.positionData.country = 'Tatooine';
    p.name = 'sw1.jpg';
    p.metadata.positionData.GPSData.latitude = 10;
    p.metadata.positionData.GPSData.longitude = 10;
    p.metadata.creationDate = Date.now() - 1000;
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
      box: {height: 10, width: 10, left: 104, top: 104},
      name: 'Unkle Ben'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 105, top: 105},
      name: 'Arvíztűrő Tükörfúrógép'
    } as FaceRegion, {
      box: {height: 10, width: 10, left: 201, top: 201},
      name: 'R2-D2'
    } as FaceRegion] as any[];
    return p;
  }

  public static getPhotoEntry2(dir: DirectoryDTO): PhotoEntity {
    const p = TestHelper.getPhotoEntry(dir);

    p.metadata.caption = 'Light saber';
    p.metadata.keywords = ['Padmé Amidala', 'star wars', 'Natalie Portman', 'death star', 'wookiee'];
    p.metadata.positionData.city = 'Derem City';
    p.metadata.positionData.state = 'Research City';
    p.metadata.positionData.country = 'Kamino';
    p.name = 'sw2.jpg';
    p.metadata.positionData.GPSData.latitude = -10;
    p.metadata.positionData.GPSData.longitude = -10;
    p.metadata.creationDate = Date.now() - 2000;
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

  public static getPhotoEntry3(dir: DirectoryDTO): PhotoEntity {
    const p = TestHelper.getPhotoEntry(dir);

    p.metadata.caption = 'Amber stone';
    p.metadata.keywords = ['star wars', 'wookiees'];
    p.metadata.positionData.city = 'Castilon';
    p.metadata.positionData.state = 'Devaron';
    p.metadata.positionData.country = 'Ajan Kloss';
    p.name = 'sw3.jpg';
    p.metadata.positionData.GPSData.latitude = 10;
    p.metadata.positionData.GPSData.longitude = 15;
    p.metadata.creationDate = Date.now() - 3000;
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

  public static getPhotoEntry4(dir: DirectoryDTO): PhotoEntity {
    const p = TestHelper.getPhotoEntry(dir);

    p.metadata.caption = 'Millennium falcon';
    p.metadata.keywords = ['star wars', 'ewoks'];
    p.metadata.positionData.city = 'Tipoca City';
    p.metadata.positionData.state = 'Exegol';
    p.metadata.positionData.country = 'Jedha';
    p.name = 'sw4.jpg';
    p.metadata.positionData.GPSData.latitude = 15;
    p.metadata.positionData.GPSData.longitude = 10;
    p.metadata.creationDate = Date.now() - 4000;
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

  public static getRandomizedDirectoryEntry(parent: DirectoryDTO = null, forceStr: string = null): DirectoryDTO<MediaDTO> {

    const dir: DirectoryDTO = {
      id: null,
      name: DiskMangerWorker.dirName(forceStr || Math.random().toString(36).substring(7)),
      path: DiskMangerWorker.pathFromParent({path: '', name: '.'}),
      mediaCount: 0,
      directories: [],
      metaFile: [],
      preview: null,
      media: [],
      lastModified: Date.now(),
      lastScanned: null,
      parent
    };
    if (parent !== null) {
      dir.path = DiskMangerWorker.pathFromParent(parent);
      parent.directories.push(dir);
    }
    return dir;
  }

  public static getRandomizedGPXEntry(dir: DirectoryDTO, forceStr: string = null): FileDTO {
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

  public static getRandomizedPhotoEntry(dir: DirectoryDTO, forceStr: string = null, faces: number = 2): PhotoDTO {


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
      altitude: rndInt(1000),
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
      creationDate: Date.now() + ++TestHelper.creationCounter,
      fileSize: rndInt(10000),
      orientation: OrientationTypes.TOP_LEFT,
      caption: rndStr(),
      rating: rndInt(5) as any,
    };


    const p: PhotoDTO = {
      id: null,
      name: rndStr() + '.jpg',
      directory: dir,
      metadata: m,
      readyThumbnails: [],
      readyIcon: false
    };

    for (let i = 0; i < faces; i++) {
      this.getRandomizedFace(p, 'Person ' + i);
    }

    dir.media.push(p);
    TestHelper.updatePreview(dir);
    return p;
  }

  static updatePreview(dir: DirectoryDTO): void {
    if (dir.media.length > 0) {
      dir.preview = dir.media.sort((a, b): number => b.metadata.creationDate - a.metadata.creationDate)[0];
    } else {
      const filtered = dir.directories.filter((d): PreviewPhotoDTO => d.preview).map((d): PreviewPhotoDTO => d.preview);
      if (filtered.length > 0) {
        dir.preview = filtered.sort((a, b): number => b.metadata.creationDate - a.metadata.creationDate)[0];
      }
    }
    if (dir.parent) {
      TestHelper.updatePreview(dir.parent);
    }

  }


}
