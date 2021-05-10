import {VideoMetadata} from '../../../common/entities/VideoDTO';
import {CameraMetadata, FaceRegion, PhotoMetadata, PositionMetaData, OrientationTypes, RatingTypes} from '../../../common/entities/PhotoDTO';
import {MediaDimension} from '../../../common/entities/MediaDTO';
import {Config} from '../../../common/config/private/Config';
import {Logger} from '../../Logger';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import {FFmpegFactory} from '../FFmpegFactory';
import {FfprobeData} from 'fluent-ffmpeg';
import {exiftool, ExifDateTime, Tags} from 'exiftool-vendored';
import {Utils} from '../../../common/Utils';


const LOG_TAG = '[MetadataLoader]';
const ffmpeg = FFmpegFactory.get();

export class MetadataLoader {

  public static loadVideoMetadata(fullPath: string): Promise<VideoMetadata> {
    return new Promise<VideoMetadata>(async (resolve) => {
      let metadata: VideoMetadata = {
        size: {
          width: 1,
          height: 1
        },
        bitRate: 0,
        duration: 0,
        creationDate: 0,
        fileSize: 0,
        fps: 0
      };
      try {
        const stat = fs.statSync(fullPath);
        metadata.fileSize = stat.size;
        metadata.creationDate = stat.mtime.getTime();
      } catch (err) {
      }
      try {
        ffmpeg(fullPath).ffprobe(async (err: any, data: FfprobeData) => {
          if (!!err || data === null || !data.streams[0]) {
            return resolve(metadata);
          }


          try {
            for (const stream of data.streams) {
              if (stream.width) {
                metadata.size.width = stream.width;
                metadata.size.height = stream.height;

                if (Utils.isInt32(parseInt('' + stream.rotation, 10)) &&
                  (Math.abs(parseInt('' + stream.rotation, 10)) / 90) % 2 === 1) {
                  // noinspection JSSuspiciousNameCombination
                  metadata.size.width = stream.height;
                  // noinspection JSSuspiciousNameCombination
                  metadata.size.height = stream.width;
                }

                if (Utils.isInt32(Math.floor(parseFloat(stream.duration) * 1000))) {
                  metadata.duration = Math.floor(parseFloat(stream.duration) * 1000);
                }

                if (Utils.isInt32(parseInt(stream.bit_rate, 10))) {
                  metadata.bitRate = parseInt(stream.bit_rate, 10) || null;
                }
                if (Utils.isInt32(parseInt(stream.avg_frame_rate, 10))) {
                  metadata.fps = parseInt(stream.avg_frame_rate, 10) || null;
                }
                metadata.creationDate = Date.parse(stream.tags.creation_time) || metadata.creationDate;
                break;
              }
            }

          } catch (err) {
          }
          metadata.creationDate = metadata.creationDate || 0;
          try {
            // search for sidecar and merge metadata
            const fullPathWithoutExt = path.parse(fullPath).name;
            const sidecarPaths = [
              fullPath + '.xmp',
              fullPath + '.XMP',
              fullPathWithoutExt + '.xmp',
              fullPathWithoutExt + '.XMP',
            ];
            for (const sidecarPath of sidecarPaths) {
              if (fs.existsSync(sidecarPath)) {
                metadata = await this.loadVideoExif(sidecarPath, metadata);
                break;
              }
            }
          } catch (err) {
          }
          return resolve(metadata);
        });
      } catch (e) {
        return resolve(metadata);
      }
    });
  }

  public static loadPhotoMetadata(fullPath: string): Promise<PhotoMetadata> {
    return new Promise<PhotoMetadata>(async (resolve) => {
      let metadata: PhotoMetadata = {
        size: {width: 1, height: 1},
        orientation: OrientationTypes.TOP_LEFT,
        creationDate: 0,
        fileSize: 0
      };
      try {
        const stat = fs.statSync(fullPath);
        metadata.fileSize = stat.size;
        metadata.creationDate = stat.mtime.getTime();
      } catch (err) {
      }
      try {
        metadata = await this.loadPhotoExif(fullPath, metadata);
      } catch (err) {
      }
      try {
        // search for sidecar and merge metadata
        const fullPathWithoutExt = path.parse(fullPath).name;
        const sidecarPaths = [
          fullPath + '.xmp',
          fullPath + '.XMP',
          fullPathWithoutExt + '.xmp',
          fullPathWithoutExt + '.XMP',
        ];
        for (const sidecarPath of sidecarPaths) {
          if (fs.existsSync(sidecarPath)) {
            metadata = await this.loadPhotoExif(sidecarPath, metadata);
            break;
          }
        }
      } catch (err) {
      }
      return resolve(metadata);
    });
  }

  private static async loadPhotoExif(fullPath: string, metadata: PhotoMetadata): Promise<PhotoMetadata> {
    try {
      const exif = await exiftool.read(fullPath, ['--ifd1:all']);
      metadata.cameraData = this.decodeExifCameraData(exif, metadata.cameraData);
      metadata.positionData = this.decodeExifPositionData(exif, metadata.positionData);
      metadata.creationDate = this.decodeExifCreationDate(exif, metadata.creationDate);
      metadata.orientation = this.decodeExifOrientation(exif, metadata.orientation);
      metadata.size = this.decodeExifSize(exif, metadata.size, metadata.orientation);
      metadata.caption = this.decodeExifCaption(exif, metadata.caption);
      metadata.keywords = this.decodeExifKeywords(exif, metadata.keywords);
      metadata.rating = this.decodeExifRating(exif, metadata.rating);
      if (Config.Client.Faces.enabled) {
        const faces = this.decodeExifFaces(exif, metadata.size);
        if (faces.length > 0) {
          metadata.faces = faces;
          if (Config.Client.Faces.keywordsToPersons && metadata.faces.length > 0) {
            // remove faces from keywords
            metadata.faces.forEach((f: any) => {
              const index = metadata.keywords.indexOf(f.name);
              if (index !== -1) {
                metadata.keywords.splice(index, 1);
              }
            });
          }
        }
      }

    } catch (err) {
      Logger.debug(LOG_TAG, 'Error parsing exif', fullPath, err);
      throw err;
    }
    return metadata;
  }

  private static async loadVideoExif(fullPath: string, metadata: VideoMetadata): Promise<VideoMetadata> {
    try {
      const exif = await exiftool.read(fullPath);
      metadata.cameraData = this.decodeExifCameraData(exif, metadata.cameraData);
      metadata.positionData = this.decodeExifPositionData(exif, metadata.positionData);
      metadata.creationDate = this.decodeExifCreationDate(exif, metadata.creationDate);
      metadata.size = this.decodeExifSize(exif, metadata.size);
      metadata.caption = this.decodeExifCaption(exif, metadata.caption);
      metadata.keywords = this.decodeExifKeywords(exif, metadata.keywords);
      metadata.rating = this.decodeExifRating(exif, metadata.rating);
    } catch (err) {
      Logger.debug(LOG_TAG, 'Error parsing exif', fullPath, err);
      throw err;
    }
    return metadata;
  }

  private static decodeExifCameraData(exif: Tags, cameraData: CameraMetadata): CameraMetadata
  {
    if (exif.ISO || exif.Model ||
      exif.Make || exif.FNumber ||
      exif.ExposureTime || exif.FocalLength ||
      exif.LensModel) {
      if (exif.Model && exif.Model !== '') {
        cameraData = cameraData || {};
        cameraData.model = '' + exif.Model;
      }
      if (exif.Make && exif.Make !== '') {
        cameraData = cameraData || {};
        cameraData.make = '' + exif.Make;
      }
      if (exif.LensModel && exif.LensModel !== '') {
        cameraData = cameraData || {};
        cameraData.lens = '' + exif.LensModel;
      }
      if (Utils.isUInt32(exif.ISO)) {
        cameraData = cameraData || {};
        cameraData.ISO = parseInt('' + exif.ISO, 10);
      }
      if (exif.FocalLength && exif.FocalLength !== '') {
        cameraData = cameraData || {};
        cameraData.focalLength = parseFloat('' + exif.FocalLength);
      }

      if (exif.ExposureTime) {
        cameraData = cameraData || {};
        if (('' + exif.ExposureTime).indexOf('/') !== -1) {
          const f = exif.ExposureTime.split('/');
          cameraData.exposure = parseFloat(f[0]) / parseFloat(f[1]);
        } else {
          cameraData.exposure = parseFloat('' + exif.ExposureTime);
        }
      }
      if (Utils.isFloat32(exif.FNumber)) {
        cameraData = cameraData || {};
        cameraData.fStop = parseFloat('' + exif.FNumber);
      }
    }
    return cameraData;
  }

  private static decodeExifPositionData(exif: Tags, positionData: PositionMetaData): PositionMetaData
  {
    if (!isNaN(exif.GPSLatitude) || exif.GPSLongitude || exif.GPSAltitude) {
      positionData = positionData || {};
      positionData.GPSData = {};

      if (Utils.isFloat32(exif.GPSLongitude)) {
        positionData.GPSData.longitude = exif.GPSLongitude;
      }
      if (Utils.isFloat32(exif.GPSLatitude)) {
        positionData.GPSData.latitude = exif.GPSLatitude;
      }
      if (Utils.isFloat32(exif.GPSAltitude)) {
        positionData.GPSData.altitude = exif.GPSAltitude;
      }
    }
    if (exif['Country-PrimaryLocationName'] || exif.Country) {
      positionData = positionData || {};
      positionData.country = (exif['Country-PrimaryLocationName'] || exif.Country).replace(/\0/g, '').trim();
    }
    if (exif['Province-State'] || exif.State) {
      positionData = positionData || {};
      positionData.state = (exif['Province-State'] || exif.State).replace(/\0/g, '').trim();
    }
    if (exif.City) {
      positionData = positionData || {};
      positionData.city = exif.City.replace(/\0/g, '').trim();
    }
    return positionData;
  }

  private static decodeExifCreationDate(exif: Tags, creationDate: number): number
  {
    if (exif.CreateDate instanceof ExifDateTime || exif.DateTimeOriginal instanceof ExifDateTime || exif.ModifyDate instanceof ExifDateTime) {
      const myDate = (exif.DateTimeOriginal instanceof ExifDateTime && exif.DateTimeOriginal ||
        exif.CreateDate instanceof ExifDateTime && exif.CreateDate ||
        exif.ModifyDate instanceof ExifDateTime && exif.ModifyDate).toDateTime();
      // get unix time in original timezone
      creationDate = myDate.toMillis() + (myDate.offset * 60 * 1000);
    }
    return Math.max(creationDate || 0, 0);
  }

  private static decodeExifSize(exif: Tags, size: MediaDimension, orientation: OrientationTypes = null): MediaDimension
  {
    if (exif.ImageWidth) {
      size = {width: exif.ImageWidth, height: exif.ImageHeight};
    } else if (exif.RelatedImageWidth && exif.RelatedImageHeight) {
      size = {width: exif.RelatedImageWidth, height: exif.RelatedImageHeight};
    }
    if (orientation !== null && orientation !== undefined) {
      if (orientation > OrientationTypes.BOTTOM_LEFT) {
        // noinspection JSSuspiciousNameCombination
        const height = size.width;
        // noinspection JSSuspiciousNameCombination
        size.width = size.height;
        size.height = height;
      }
    }
    return size;
  }

  private static decodeExifCaption(exif: Tags, caption: string): string
  {
    if (exif.Description || exif.UserComment || exif.Comment || exif['Caption-Abstract']) {
      caption = (exif.Description || exif.UserComment || exif.Comment || exif['Caption-Abstract']).replace(/\0/g, '').trim();
    }
    return caption;
  }

  private static decodeExifKeywords(exif: Tags, keywords: string[]): string[]
  {
    return exif.Keywords || exif.Subject || keywords;
  }

  private static decodeExifRating(exif: Tags, rating: RatingTypes): RatingTypes
  {
    if (exif.Rating) {
      rating = (parseInt('' + exif.Rating, 10) as any);
    }
    return rating;
  }

  private static decodeExifOrientation(exif: Tags, orientation: OrientationTypes): OrientationTypes
  {
    if (exif.Orientation !== undefined) {
      orientation = (parseInt(exif.Orientation as any, 10) as any);
    }
    return orientation;
  }

  private static decodeExifFaces(exif: Tags, size: MediaDimension): FaceRegion[]
  {
    const faces: FaceRegion[] = [];
    if (exif.RegionInfo && exif.RegionInfo.RegionList) {
      for (const regionRoot of exif.RegionInfo.RegionList as any) {

        let type;
        let name;
        let box;
        const createFaceBox = (w: string, h: string, x: string, y: string) => {
          return {
            width: Math.round(parseFloat(w) * size.width),
            height: Math.round(parseFloat(h) * size.height),
            left: Math.round(parseFloat(x) * size.width),
            top: Math.round(parseFloat(y) * size.height)
          };
        };

        if (regionRoot.Area && regionRoot.Name && regionRoot.Type) {

          const regionBox = regionRoot.Area;
          name = regionRoot.Name;
          type = regionRoot.Type;
          box = createFaceBox(regionBox.W,
            regionBox.H,
            regionBox.X,
            regionBox.Y);
        }

        if (type !== 'Face' || !name) {
          continue;
        }
        // convert center base box to corner based box
        box.left = Math.max(0, box.left - box.width / 2);
        box.top = Math.max(0, box.top - box.height / 2);
        faces.push({name, box});
      }
    }
    return faces;
  }

}
