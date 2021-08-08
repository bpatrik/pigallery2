import {VideoMetadata} from '../../../common/entities/VideoDTO';
import {FaceRegion, PhotoMetadata} from '../../../common/entities/PhotoDTO';
import {Config} from '../../../common/config/private/Config';
import {Logger} from '../../Logger';
import * as fs from 'fs';
import {imageSize} from 'image-size';
// @ts-ignore
import * as ExifReader from 'exifreader';
import {ExifParserFactory, OrientationTypes} from 'ts-exif-parser';
import {IptcParser} from 'ts-node-iptc';
import {FFmpegFactory} from '../FFmpegFactory';
import {FfprobeData} from 'fluent-ffmpeg';
import {Utils} from '../../../common/Utils';


const LOG_TAG = '[MetadataLoader]';
const ffmpeg = FFmpegFactory.get();

export class MetadataLoader {

  public static loadVideoMetadata(fullPath: string): Promise<VideoMetadata> {
    return new Promise<VideoMetadata>((resolve) => {
      const metadata: VideoMetadata = {
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
        ffmpeg(fullPath).ffprobe((err: any, data: FfprobeData) => {
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

          return resolve(metadata);
        });
      } catch (e) {
        return resolve(metadata);
      }
    });
  }

  public static loadPhotoMetadata(fullPath: string): Promise<PhotoMetadata> {
    return new Promise<PhotoMetadata>((resolve, reject) => {
        const fd = fs.openSync(fullPath, 'r');

        const data = Buffer.allocUnsafe(Config.Server.photoMetadataSize);
        fs.read(fd, data, 0, Config.Server.photoMetadataSize, 0, (err) => {
          fs.closeSync(fd);
          if (err) {
            return reject({file: fullPath, error: err});
          }
          const metadata: PhotoMetadata = {
            size: {width: 1, height: 1},
            orientation: OrientationTypes.TOP_LEFT,
            creationDate: 0,
            fileSize: 0
          };
          try {

            try {
              const stat = fs.statSync(fullPath);
              metadata.fileSize = stat.size;
              metadata.creationDate = stat.mtime.getTime();
            } catch (err) {
            }

            try {
              const exif = ExifParserFactory.create(data).parse();
              if (exif.tags.ISO || exif.tags.Model ||
                exif.tags.Make || exif.tags.FNumber ||
                exif.tags.ExposureTime || exif.tags.FocalLength ||
                exif.tags.LensModel) {
                if (exif.tags.Model && exif.tags.Model !== '') {
                  metadata.cameraData = metadata.cameraData || {};
                  metadata.cameraData.model = '' + exif.tags.Model;
                }
                if (exif.tags.Make && exif.tags.Make !== '') {
                  metadata.cameraData = metadata.cameraData || {};
                  metadata.cameraData.make = '' + exif.tags.Make;
                }
                if (exif.tags.LensModel && exif.tags.LensModel !== '') {
                  metadata.cameraData = metadata.cameraData || {};
                  metadata.cameraData.lens = '' + exif.tags.LensModel;
                }
                if (Utils.isUInt32(exif.tags.ISO)) {
                  metadata.cameraData = metadata.cameraData || {};
                  metadata.cameraData.ISO = parseInt('' + exif.tags.ISO, 10);
                }
                if (Utils.isFloat32(exif.tags.FocalLength)) {
                  metadata.cameraData = metadata.cameraData || {};
                  metadata.cameraData.focalLength = parseFloat('' + exif.tags.FocalLength);
                }
                if (Utils.isFloat32(exif.tags.ExposureTime)) {
                  metadata.cameraData = metadata.cameraData || {};
                  metadata.cameraData.exposure = parseFloat('' + exif.tags.ExposureTime);
                }
                if (Utils.isFloat32(exif.tags.FNumber)) {
                  metadata.cameraData = metadata.cameraData || {};
                  metadata.cameraData.fStop = parseFloat('' + exif.tags.FNumber);
                }
              }
              if (!isNaN(exif.tags.GPSLatitude) || exif.tags.GPSLongitude || exif.tags.GPSAltitude) {
                metadata.positionData = metadata.positionData || {};
                metadata.positionData.GPSData = {};

                if (Utils.isFloat32(exif.tags.GPSLongitude)) {
                  metadata.positionData.GPSData.longitude = exif.tags.GPSLongitude;
                }
                if (Utils.isFloat32(exif.tags.GPSLatitude)) {
                  metadata.positionData.GPSData.latitude = exif.tags.GPSLatitude;
                }
                if (Utils.isInt32(exif.tags.GPSAltitude)) {
                  metadata.positionData.GPSData.altitude = exif.tags.GPSAltitude;
                }
              }
              if (exif.tags.CreateDate || exif.tags.DateTimeOriginal || exif.tags.ModifyDate) {
                metadata.creationDate = (exif.tags.DateTimeOriginal || exif.tags.CreateDate || exif.tags.ModifyDate) * 1000;
              }


              if (exif.imageSize) {
                metadata.size = {width: exif.imageSize.width, height: exif.imageSize.height};
              } else if (exif.tags.RelatedImageWidth && exif.tags.RelatedImageHeight) {
                metadata.size = {width: exif.tags.RelatedImageWidth, height: exif.tags.RelatedImageHeight};
              } else {
                const info = imageSize(fullPath);
                metadata.size = {width: info.width, height: info.height};
              }
            } catch (err) {
              Logger.debug(LOG_TAG, 'Error parsing exif', fullPath, err);
              try {
                const info = imageSize(fullPath);
                metadata.size = {width: info.width, height: info.height};
              } catch (e) {
                metadata.size = {width: 1, height: 1};
              }
            }

            try {
              const iptcData = IptcParser.parse(data);
              if (iptcData.country_or_primary_location_name) {
                metadata.positionData = metadata.positionData || {};
                metadata.positionData.country = iptcData.country_or_primary_location_name.replace(/\0/g, '').trim();
              }
              if (iptcData.province_or_state) {
                metadata.positionData = metadata.positionData || {};
                metadata.positionData.state = iptcData.province_or_state.replace(/\0/g, '').trim();
              }
              if (iptcData.city) {
                metadata.positionData = metadata.positionData || {};
                metadata.positionData.city = iptcData.city.replace(/\0/g, '').trim();
              }
              if (iptcData.caption) {
                metadata.caption = iptcData.caption.replace(/\0/g, '').trim();
              }
              if (Array.isArray(iptcData.keywords)) {
                metadata.keywords = iptcData.keywords;
              }

              if (iptcData.date_time) {
                metadata.creationDate = iptcData.date_time.getTime();
              }

            } catch (err) {
              // Logger.debug(LOG_TAG, 'Error parsing iptc data', fullPath, err);
            }

            if (!metadata.creationDate) { // creationDate can be negative, when it was created before epoch (1970)
              metadata.creationDate = 0;
            }

            try {
              // TODO: clean up the three different exif readers,
              //  and keep the minimum amount only
              const exif = ExifReader.load(data);
              if (exif.Rating) {
                metadata.rating = (parseInt(exif.Rating.value, 10) as any);
              }
              if (exif.subject && exif.subject.value && exif.subject.value.length > 0) {
                if (metadata.keywords === undefined) {
                  metadata.keywords = [];
                }
                for (const kw of exif.subject.value) {
                  if (metadata.keywords.indexOf(kw.description) === -1) {
                    metadata.keywords.push(kw.description);
                  }
                }
              }
              if (exif.Orientation) {
                metadata.orientation = (parseInt(exif.Orientation.value as any, 10) as any);
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
                if (exif.Regions && exif.Regions.value.RegionList && exif.Regions.value.RegionList.value) {
                  for (const regionRoot of exif.Regions.value.RegionList.value as any[]) {

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

                    /* Adobe Lightroom based face region structure */
                    if (regionRoot.value &&
                      regionRoot.value['rdf:Description'] &&
                      regionRoot.value['rdf:Description'].value &&
                      regionRoot.value['rdf:Description'].value['mwg-rs:Area']) {

                      const region = regionRoot.value['rdf:Description'];
                      const regionBox = region.value['mwg-rs:Area'].attributes;

                      name = region.attributes['mwg-rs:Name'];
                      type = region.attributes['mwg-rs:Type'];
                      box = createFaceBox(regionBox['stArea:w'],
                        regionBox['stArea:h'],
                        regionBox['stArea:x'],
                        regionBox['stArea:y']);
                      /* Load exiftool edited face region structure, see github issue #191 */
                    } else if (regionRoot.Area && regionRoot.Name && regionRoot.Type) {

                      const regionBox = regionRoot.Area.value;
                      name = decodeURIComponent(escape(regionRoot.Name.value));
                      type = regionRoot.Type.value;
                      box = createFaceBox(regionBox.w.value,
                        regionBox.h.value,
                        regionBox.x.value,
                        regionBox.y.value);
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
                if (faces.length > 0) {
                  metadata.faces = faces; // save faces
                  if (Config.Client.Faces.keywordsToPersons) {
                    // remove faces from keywords
                    metadata.faces.forEach(f => {
                      const index = metadata.keywords.indexOf(f.name);
                      if (index !== -1) {
                        metadata.keywords.splice(index, 1);
                      }
                    });
                  }
                }
              }
            } catch (err) {
            }


            return resolve(metadata);
          } catch (err) {
            return reject({file: fullPath, error: err});
          }
        });
      }
    );
  }

}
