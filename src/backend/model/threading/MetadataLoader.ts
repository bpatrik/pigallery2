import {VideoMetadata} from '../../../common/entities/VideoDTO';
import {FaceRegion, PhotoMetadata} from '../../../common/entities/PhotoDTO';
import {Config} from '../../../common/config/private/Config';
import {Logger} from '../../Logger';
import * as fs from 'fs';
import * as path from 'path';
import {imageSize} from 'image-size';
// @ts-ignore
import {OrientationTypes} from 'ts-exif-parser';
import {FFmpegFactory} from '../FFmpegFactory';
import {FfprobeData} from 'fluent-ffmpeg';
import {exiftool, ExifDateTime} from 'exiftool-vendored';
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
        try {
          const info = imageSize(fullPath);
          metadata.size = {width: info.width, height: info.height};
        } catch (e) {
          metadata.size = {width: 1, height: 1};
        }
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
      const exif = await exiftool.read(fullPath);
      if (exif.ISO || exif.Model ||
        exif.Make || exif.FNumber ||
        exif.ExposureTime || exif.FocalLength ||
        exif.LensModel) {
        if (exif.Model && exif.Model !== '') {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.model = '' + exif.Model;
        }
        if (exif.Make && exif.Make !== '') {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.make = '' + exif.Make;
        }
        if (exif.LensModel && exif.LensModel !== '') {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.lens = '' + exif.LensModel;
        }
        if (Utils.isUInt32(exif.ISO)) {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.ISO = parseInt('' + exif.ISO, 10);
        }
        if (exif.FocalLength && exif.FocalLength !== '') {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.focalLength = parseFloat('' + exif.FocalLength);
        }

        if (exif.ExposureTime) {
          metadata.cameraData = metadata.cameraData || {};
          if (('' + exif.ExposureTime).indexOf('/') !== -1) {
            const f = exif.ExposureTime.split('/');
            metadata.cameraData.exposure = parseFloat(f[0]) / parseFloat(f[1]);
          } else {
            metadata.cameraData.exposure = parseFloat('' + exif.ExposureTime);
          }
        }
        if (Utils.isFloat32(exif.FNumber)) {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.fStop = parseFloat('' + exif.FNumber);
        }
      }
      if (!isNaN(exif.GPSLatitude) || exif.GPSLongitude || exif.GPSAltitude) {
        metadata.positionData = metadata.positionData || {};
        metadata.positionData.GPSData = {};

        if (Utils.isFloat32(exif.GPSLongitude)) {
          metadata.positionData.GPSData.longitude = exif.GPSLongitude;
        }
        if (Utils.isFloat32(exif.GPSLatitude)) {
          metadata.positionData.GPSData.latitude = exif.GPSLatitude;
        }
        if (Utils.isFloat32(exif.GPSAltitude)) {
          metadata.positionData.GPSData.altitude = exif.GPSAltitude;
        }
      }
      if (exif.CreateDate instanceof ExifDateTime || exif.DateTimeOriginal instanceof ExifDateTime || exif.ModifyDate instanceof ExifDateTime) {
        metadata.creationDate = (exif.DateTimeOriginal instanceof ExifDateTime && exif.DateTimeOriginal.toDate().getTime() ||
          exif.CreateDate instanceof ExifDateTime && exif.CreateDate.toDate().getTime() ||
          exif.ModifyDate instanceof ExifDateTime && exif.ModifyDate.toDate().getTime());
      }

      if (exif.ImageWidth) {
        metadata.size = {width: exif.ImageWidth, height: exif.ImageHeight};
      } else if (exif.RelatedImageWidth && exif.RelatedImageHeight) {
        metadata.size = {width: exif.RelatedImageWidth, height: exif.RelatedImageHeight};
      } else {
        const info = imageSize(fullPath);
        metadata.size = {width: info.width, height: info.height};
      }

      if (exif.Country || exif['Country-PrimaryLocationName']) {
        metadata.positionData = metadata.positionData || {};
        metadata.positionData.country = (exif.Country || exif['Country-PrimaryLocationName']).replace(/\0/g, '').trim();
      }
      if (exif.State || exif['Province-State']) {
        metadata.positionData = metadata.positionData || {};
        metadata.positionData.state = (exif.State || exif['Province-State']).replace(/\0/g, '').trim();
      }
      if (exif.City) {
        metadata.positionData = metadata.positionData || {};
        metadata.positionData.city = exif.City.replace(/\0/g, '').trim();
      }
      if (exif.Description || exif.UserComment || exif.Comment || exif['Caption-Abstract']) {
        metadata.caption = (exif.Description || exif.UserComment || exif.Comment || exif['Caption-Abstract']).replace(/\0/g, '').trim();
      }

      metadata.keywords = exif.Keywords || exif.Subject || [];

      metadata.creationDate = Math.max(metadata.creationDate || 0, 0);

      if (exif.Rating) {
        metadata.rating = (parseInt('' + exif.Rating, 10) as any);
      }

      if (exif.Orientation) {
        metadata.orientation = (parseInt(exif.Orientation as any, 10) as any);
        if (OrientationTypes.BOTTOM_LEFT < metadata.orientation) {
          // noinspection JSSuspiciousNameCombination
          const height = metadata.size.width;
          // noinspection JSSuspiciousNameCombination
          metadata.size.width = metadata.size.height;
          metadata.size.height = height;
        }
      }

      if (Config.Client.Faces.enabled) {
        const faces: FaceRegion[] = [];
        if (exif.RegionInfo && exif.RegionInfo.RegionList) {
          for (const regionRoot of exif.RegionInfo.RegionList as any) {

            let type;
            let name;
            let box;
            const createFaceBox = (w: string, h: string, x: string, y: string) => {
              return {
                width: Math.round(parseFloat(w) * metadata.size.width),
                height: Math.round(parseFloat(h) * metadata.size.height),
                left: Math.round(parseFloat(x) * metadata.size.width),
                top: Math.round(parseFloat(y) * metadata.size.height)
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
        if (Config.Client.Faces.keywordsToPersons && faces.length > 0) {
          metadata.faces = faces; // save faces
          // remove faces from keywords
          metadata.faces.forEach((f: any) => {
            const index = metadata.keywords.indexOf(f.name);
            if (index !== -1) {
              metadata.keywords.splice(index, 1);
            }
          });
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
      if (exif.ISO || exif.Model ||
        exif.Make || exif.FNumber ||
        exif.ExposureTime || exif.FocalLength ||
        exif.LensModel) {
        if (exif.Model && exif.Model !== '') {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.model = '' + exif.Model;
        }
        if (exif.Make && exif.Make !== '') {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.make = '' + exif.Make;
        }
        if (exif.LensModel && exif.LensModel !== '') {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.lens = '' + exif.LensModel;
        }
        if (Utils.isUInt32(exif.ISO)) {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.ISO = parseInt('' + exif.ISO, 10);
        }
        if (exif.FocalLength && exif.FocalLength !== '') {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.focalLength = parseFloat('' + exif.FocalLength);
        }
        if (exif.ExposureTime) {
          metadata.cameraData = metadata.cameraData || {};
          if (('' + exif.ExposureTime).indexOf('/') !== -1) {
            const f = exif.ExposureTime.split('/');
            metadata.cameraData.exposure = parseFloat(f[0]) / parseFloat(f[1]);
          } else {
            metadata.cameraData.exposure = parseFloat('' + exif.ExposureTime);
          }
        }
        if (Utils.isFloat32(exif.FNumber)) {
          metadata.cameraData = metadata.cameraData || {};
          metadata.cameraData.fStop = parseFloat('' + exif.FNumber);
        }
      }
      if (!isNaN(exif.GPSLatitude) || exif.GPSLongitude || exif.GPSAltitude) {
        metadata.positionData = metadata.positionData || {};
        metadata.positionData.GPSData = {};

        if (Utils.isFloat32(exif.GPSLongitude)) {
          metadata.positionData.GPSData.longitude = exif.GPSLongitude;
        }
        if (Utils.isFloat32(exif.GPSLatitude)) {
          metadata.positionData.GPSData.latitude = exif.GPSLatitude;
        }
        if (Utils.isFloat32(exif.GPSAltitude)) {
          metadata.positionData.GPSData.altitude = exif.GPSAltitude;
        }
      }
      if (exif.CreateDate instanceof ExifDateTime || exif.DateTimeOriginal instanceof ExifDateTime || exif.ModifyDate instanceof ExifDateTime) {
        metadata.creationDate = (exif.DateTimeOriginal instanceof ExifDateTime && exif.DateTimeOriginal.toDate().getTime() ||
          exif.CreateDate instanceof ExifDateTime && exif.CreateDate.toDate().getTime() ||
          exif.ModifyDate instanceof ExifDateTime && exif.ModifyDate.toDate().getTime());
      }

      if (exif.Country || exif['Country-PrimaryLocationName']) {
        metadata.positionData = metadata.positionData || {};
        metadata.positionData.country = (exif.Country || exif['Country-PrimaryLocationName']).replace(/\0/g, '').trim();
      }
      if (exif.State || exif['Province-State']) {
        metadata.positionData = metadata.positionData || {};
        metadata.positionData.state = (exif.State || exif['Province-State']).replace(/\0/g, '').trim();
      }
      if (exif.City) {
        metadata.positionData = metadata.positionData || {};
        metadata.positionData.city = exif.City.replace(/\0/g, '').trim();
      }
      if (exif.Description || exif.UserComment || exif.Comment || exif['Caption-Abstract']) {
        metadata.caption = (exif.Description || exif.UserComment || exif.Comment || exif['Caption-Abstract']).replace(/\0/g, '').trim();
      }

      metadata.keywords = exif.Keywords || exif.Subject || [];

      metadata.creationDate = Math.max(metadata.creationDate || 0, 0);

      if (exif.Rating) {
        metadata.rating = (parseInt('' + exif.Rating, 10) as any);
      }

    } catch (err) {
      Logger.debug(LOG_TAG, 'Error parsing exif', fullPath, err);
      throw err;
    }
    return metadata;
  }
}
