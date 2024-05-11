import * as fs from 'fs';
import { imageSize } from 'image-size';
import { Config } from '../../../common/config/private/Config';
import { FaceRegion, PhotoMetadata } from '../../../common/entities/PhotoDTO';
import { VideoMetadata } from '../../../common/entities/VideoDTO';
import { RatingTypes } from '../../../common/entities/MediaDTO';
import { Logger } from '../../Logger';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as exifr from 'exifr';
import { FfprobeData } from 'fluent-ffmpeg';
import { FileHandle } from 'fs/promises';
import * as util from 'node:util';
import * as path from 'path';
import { Utils } from '../../../common/Utils';
import { FFmpegFactory } from '../FFmpegFactory';
import { ExtensionDecorator } from '../extension/ExtensionDecorator';
import { DateTags } from './MetadataCreationDate';

const LOG_TAG = '[MetadataLoader]';
const ffmpeg = FFmpegFactory.get();

export class MetadataLoader {

  @ExtensionDecorator(e => e.gallery.MetadataLoader.loadVideoMetadata)
  public static async loadVideoMetadata(fullPath: string): Promise<VideoMetadata> {
    const metadata: VideoMetadata = {
      size: {
        width: 1,
        height: 1,
      },
      bitRate: 0,
      duration: 0,
      creationDate: 0,
      fileSize: 0,
      fps: 0,
    };

    try {
      const stat = fs.statSync(fullPath);
      metadata.fileSize = stat.size;
      metadata.creationDate = stat.mtime.getTime(); //Default date is file system time of last modification
    } catch (err) {
      console.log(err);
      // ignoring errors
    }
    try {


      const data: FfprobeData = await util.promisify<FfprobeData>(
        // wrap to arrow function otherwise 'this' is lost for ffprobe
        (cb) => ffmpeg(fullPath).ffprobe(cb)
      )();

      try {
        for (const stream of data.streams) {
          if (stream.width) {
            metadata.size.width = stream.width;
            metadata.size.height = stream.height;

            if (
              Utils.isInt32(parseInt('' + stream.rotation, 10)) &&
              (Math.abs(parseInt('' + stream.rotation, 10)) / 90) % 2 === 1
            ) {
              // noinspection JSSuspiciousNameCombination
              metadata.size.width = stream.height;
              // noinspection JSSuspiciousNameCombination
              metadata.size.height = stream.width;
            }

            if (
              Utils.isInt32(Math.floor(parseFloat(stream.duration) * 1000))
            ) {
              metadata.duration = Math.floor(
                parseFloat(stream.duration) * 1000
              );
            }

            if (Utils.isInt32(parseInt(stream.bit_rate, 10))) {
              metadata.bitRate = parseInt(stream.bit_rate, 10) || null;
            }
            if (Utils.isInt32(parseInt(stream.avg_frame_rate, 10))) {
              metadata.fps = parseInt(stream.avg_frame_rate, 10) || null;
            }
            if (
              stream.tags !== undefined &&
              typeof stream.tags.creation_time === 'string'
            ) {
              metadata.creationDate =
                Date.parse(stream.tags.creation_time) ||
                metadata.creationDate;
            }
            break;
          }
        }

        // For some filetypes (for instance Matroska), bitrate and duration are stored in
        // the format section, not in the stream section.

        // Only use duration from container header if necessary (stream duration is usually more accurate)
        if (
          metadata.duration === 0 &&
          data.format.duration !== undefined &&
          Utils.isInt32(Math.floor(data.format.duration * 1000))
        ) {
          metadata.duration = Math.floor(data.format.duration * 1000);
        }

        // Prefer bitrate from container header (includes video and audio)
        if (
          data.format.bit_rate !== undefined &&
          Utils.isInt32(data.format.bit_rate)
        ) {
          metadata.bitRate = data.format.bit_rate;
        }

        if (
          data.format.tags !== undefined &&
          typeof data.format.tags.creation_time === 'string'
        ) {
          metadata.creationDate =
            Date.parse(data.format.tags.creation_time) ||
            metadata.creationDate;
        }

        // eslint-disable-next-line no-empty
      } catch (err) {
        Logger.silly(LOG_TAG, 'Error loading metadata for : ' + fullPath);
        Logger.silly(err);
      }
      metadata.creationDate = metadata.creationDate || 0;

      try {
        // search for sidecar and merge metadata
        const fullPathWithoutExt = path.join(path.parse(fullPath).dir, path.parse(fullPath).name);
        const sidecarPaths = [
          fullPath + '.xmp',
          fullPath + '.XMP',
          fullPathWithoutExt + '.xmp',
          fullPathWithoutExt + '.XMP',
        ];

        for (const sidecarPath of sidecarPaths) {
          if (fs.existsSync(sidecarPath)) {
            const sidecarData: any = await exifr.sidecar(sidecarPath);
            if (sidecarData !== undefined) {
              MetadataLoader.mapMetadata(metadata, sidecarData);
            }
          }
        }
      } catch (err) {
        Logger.silly(LOG_TAG, 'Error loading sidecar metadata for : ' + fullPath);
        Logger.silly(err);
      }

    } catch (err) {
      Logger.silly(LOG_TAG, 'Error loading metadata for : ' + fullPath);
      Logger.silly(err);
    }

    return metadata;
  }

  private static readonly EMPTY_METADATA: PhotoMetadata = {
    size: { width: 0, height: 0 },
    creationDate: 0,
    fileSize: 0,
  };

  @ExtensionDecorator(e => e.gallery.MetadataLoader.loadPhotoMetadata)
  public static async loadPhotoMetadata(fullPath: string): Promise<PhotoMetadata> {
    let fileHandle: FileHandle;
    const metadata: PhotoMetadata = {
      size: { width: 0, height: 0 },
      creationDate: 0,
      fileSize: 0,
    };
    const exifrOptions = {
      tiff: true,
      xmp: true,
      icc: false,
      jfif: false, //not needed and not supported for png
      ihdr: true,
      iptc: true, 
      exif: true,
      gps: true,
      reviveValues: false, //don't convert timestamps
      translateValues: false, //don't translate orientation from numbers to strings etc.
      mergeOutput: false //don't merge output, because things like Microsoft Rating (percent) and xmp.rating will be merged
    };
    try {
      let bufferSize = Config.Media.photoMetadataSize;
      try {
        const stat = fs.statSync(fullPath);
        metadata.fileSize = stat.size;
        //No reason to make the buffer larger than the actual file
        bufferSize = Math.min(Config.Media.photoMetadataSize, metadata.fileSize);
        metadata.creationDate = stat.mtime.getTime();
      } catch (err) {
        // ignoring errors
      }
      try {
        //read the actual image size, don't rely on tags for this
        const info = imageSize(fullPath);
        metadata.size = { width: info.width, height: info.height };
      } catch (e) {
        //in case of failure, set dimensions to 0 so they may be read via tags
        metadata.size = { width: 0, height: 0 };
      } finally {
        if (isNaN(metadata.size.width) || metadata.size.width == null) {
          metadata.size.width = 0;
        }
        if (isNaN(metadata.size.height) || metadata.size.height == null) {
          metadata.size.height = 0;
        }
      }


      const data = Buffer.allocUnsafe(bufferSize);
      fileHandle = await fs.promises.open(fullPath, 'r');
      try {
        await fileHandle.read(data, 0, bufferSize, 0);
      } catch (err) {
        Logger.error(LOG_TAG, 'Error during reading photo: ' + fullPath);
        console.error(err);
        return MetadataLoader.EMPTY_METADATA;
      } finally {
        await fileHandle.close();
      }
      try {
        try {
          const exif = await exifr.parse(data, exifrOptions);
          MetadataLoader.mapMetadata(metadata, exif);
        } catch (err) {
          // ignoring errors
        }

        try {
          // search for sidecar and merge metadata
          const fullPathWithoutExt = path.join(path.parse(fullPath).dir, path.parse(fullPath).name);
          const sidecarPaths = [
            fullPath + '.xmp',
            fullPath + '.XMP',
            fullPathWithoutExt + '.xmp',
            fullPathWithoutExt + '.XMP',
          ];

          for (const sidecarPath of sidecarPaths) {
            if (fs.existsSync(sidecarPath)) {
              const sidecarData: any = await exifr.sidecar(sidecarPath, exifrOptions);
              if (sidecarData !== undefined) {
                //note that since side cars are loaded last, data loaded here overwrites embedded metadata (in Pigallery2, not in the actual files)
                MetadataLoader.mapMetadata(metadata, sidecarData);
                break;
              }
            }
          }
        } catch (err) {
          Logger.silly(LOG_TAG, 'Error loading sidecar metadata for : ' + fullPath);
          Logger.silly(err);
        }
        if (!metadata.creationDate) {
          // creationDate can be negative, when it was created before epoch (1970)
          metadata.creationDate = 0;
        }
      } catch (err) {
        Logger.error(LOG_TAG, 'Error during reading photo: ' + fullPath);
        console.error(err);
        return MetadataLoader.EMPTY_METADATA;
      }
    } catch (err) {
      Logger.error(LOG_TAG, 'Error during reading photo: ' + fullPath);
      console.error(err);
      return MetadataLoader.EMPTY_METADATA;
    }
    return metadata;
  }

  private static mapMetadata(metadata: PhotoMetadata, exif: any) {
    //replace adobe xap-section with xmp to reuse parsing
    if (Object.hasOwn(exif, 'xap')) {
      exif['xmp'] = exif['xap'];
      delete exif['xap'];
    }
    const orientation = MetadataLoader.getOrientation(exif);
    MetadataLoader.mapImageDimensions(metadata, exif, orientation);
    MetadataLoader.mapKeywords(metadata, exif);
    MetadataLoader.mapTitle(metadata, exif);
    MetadataLoader.mapCaption(metadata, exif);
    MetadataLoader.mapTimestampAndOffset(metadata, exif);
    MetadataLoader.mapCameraData(metadata, exif);
    MetadataLoader.mapGPS(metadata, exif);
    MetadataLoader.mapToponyms(metadata, exif);
    MetadataLoader.mapRating(metadata, exif);
    if (Config.Faces.enabled) {
      MetadataLoader.mapFaces(metadata, exif, orientation);
    }

  }
  private static getOrientation(exif: any): number {
    let orientation = 1; //Orientation 1 is normal
    if (exif.ifd0?.Orientation != undefined) {
      orientation = parseInt(exif.ifd0.Orientation as any, 10) as number;
    }
    return orientation;
  }

  private static mapImageDimensions(metadata: PhotoMetadata, exif: any, orientation: number) {
    if (metadata.size.width <= 0) {
      metadata.size.width = exif.ifd0?.ImageWidth || exif.exif?.ExifImageWidth || metadata.size.width;
    }
    if (metadata.size.height <= 0) {
      metadata.size.height = exif.ifd0?.ImageHeight || exif.exif?.ExifImageHeight || metadata.size.height;
    }
    metadata.size.height = Math.max(metadata.size.height, 1); //ensure height dimension is positive
    metadata.size.width = Math.max(metadata.size.width, 1); //ensure width  dimension is positive

    //we need to switch width and height for images that are rotated sideways
    if (4 < orientation) { //Orientation is sideways (rotated 90% or 270%)
      // noinspection JSSuspiciousNameCombination
      const height = metadata.size.width;
      // noinspection JSSuspiciousNameCombination
      metadata.size.width = metadata.size.height;
      metadata.size.height = height;
    }
  }

  private static mapKeywords(metadata: PhotoMetadata, exif: any) {
    if (exif.dc &&
      exif.dc.subject &&
      exif.dc.subject.length > 0) {
      const subj = Array.isArray(exif.dc.subject) ? exif.dc.subject : [exif.dc.subject];
      if (metadata.keywords === undefined) {
        metadata.keywords = [];
      }
      for (const kw of subj) {
        if (metadata.keywords.indexOf(kw) === -1) {
          metadata.keywords.push(kw);
        }
      }
    }
    if (exif.iptc &&
      exif.iptc.Keywords &&
      exif.iptc.Keywords.length > 0) {
      const subj = Array.isArray(exif.iptc.Keywords) ? exif.iptc.Keywords : [exif.iptc.Keywords];
      if (metadata.keywords === undefined) {
        metadata.keywords = [];
      }
      for (let kw of subj) {
        kw = Utils.asciiToUTF8(kw);
        if (metadata.keywords.indexOf(kw) === -1) {
          metadata.keywords.push(kw);
        }
      }
    }
  }

  private static mapTitle(metadata: PhotoMetadata, exif: any) {
    metadata.title = exif.dc?.title?.value || Utils.asciiToUTF8(exif.iptc?.ObjectName) || metadata.title || exif.photoshop?.Headline || exif.acdsee?.caption; //acdsee caption holds the title when data is saved by digikam. Used as last resort if iptc and dc do not contain the data
  }

  private static mapCaption(metadata: PhotoMetadata, exif: any) {
    metadata.caption = exif.dc?.description?.value || Utils.asciiToUTF8(exif.iptc?.Caption) || metadata.caption || exif.ifd0?.ImageDescription || exif.exif?.UserComment?.value || exif.Iptc4xmpCore?.ExtDescrAccessibility?.value ||exif.acdsee?.notes;
  }

  private static mapTimestampAndOffset(metadata: PhotoMetadata, exif: any) {
    //This method looks for date tags matching the priorized list 'DateTags' of 'MetadataCreationDate'
    let ts: string, offset: string;
    for (let i = 0; i < DateTags.length; i++) {
      const [mainpath, extrapath, extratype] = DateTags[i];
      [ts, offset] = extractTSAndOffset(mainpath, extrapath, extratype);
      if (ts) {
        if (!offset) { //We don't have the offset from the timestamp or from extra tag, let's see if we can find it in another way
          //Check the explicit offset tags. Otherwise calculate from GPS
          offset = exif.exif?.OffsetTimeOriginal || exif.exif?.OffsetTimeDigitized || exif.exif?.OffsetTime || Utils.getTimeOffsetByGPSStamp(ts, exif.exif?.GPSTimeStamp, exif.gps);
        }
        if (!offset) { //still no offset? let's look for a timestamp with offset in the rest of the DateTags list
          const [tsonly, tsoffset] = Utils.splitTimestampAndOffset(ts);
          for (let j = i+1; j < DateTags.length; j++) {
            const [exts, exOffset] = extractTSAndOffset(DateTags[j][0], DateTags[j][1], DateTags[j][2]);
            if (exts && exOffset && Math.abs(Utils.timestampToMS(tsonly, null) - Utils.timestampToMS(exts, null)) < 30000) {
              //if there is an offset and the found timestamp is within 30 seconds of the extra timestamp, we will use the offset from the found timestamp
              offset = exOffset;
              break;
            }
          }
        }
        break; //timestamp is found, look no further
      }
    }
    metadata.creationDate = Utils.timestampToMS(ts, offset) || metadata.creationDate;
    metadata.creationDateOffset = offset || metadata.creationDateOffset;
    //---- End of mapTimestampAndOffset logic ----

    //---- Helper functions for mapTimestampAndOffset ----
    function getValue(exif: any, path: string): any {
      const pathElements = path.split('.');
      let currentObject: any = exif;
      for (const pathElm of pathElements) {
          const tmp = currentObject[pathElm];
          if (tmp === undefined) {
              return undefined;
          }
          currentObject = tmp;
      }
      return currentObject;
    }
  
    function extractTSAndOffset(mainpath: string, extrapath: string, extratype: string) {
      let ts: string | undefined = undefined;
      let offset: string | undefined = undefined;
      //line below is programmatic way of finding a timestamp in the exif object. For example "xmp.CreateDate", from the DateTags list
      //ts = exif.xmp?.CreateDate
      ts = getValue(exif, mainpath);
      if (ts) {
        if (!extratype || extratype == 'O') { //offset can be in the timestamp itself
          [ts, offset] = Utils.splitTimestampAndOffset(ts);
          if (extratype == 'O' && !offset) { //offset in the extra tag and not already extracted from main tag
              offset = getValue(exif, extrapath);
          }
        } else if (extratype == 'T') { //date only in main tag, time in the extra tag
          ts = Utils.toIsoTimestampString(ts, getValue(exif, extrapath));
          [ts, offset] = Utils.splitTimestampAndOffset(ts);
        }
      }
      return [ts, offset];
    }
    

  }

  private static mapCameraData(metadata: PhotoMetadata, exif: any) {
    metadata.cameraData = metadata.cameraData || {};
    metadata.cameraData.make = exif.ifd0?.Make || exif.tiff?.Make || metadata.cameraData.make;

    metadata.cameraData.model = exif.ifd0?.Model || exif.tiff?.Model || metadata.cameraData.model;

    metadata.cameraData.lens = exif.exif?.LensModel || exif.exifEX?.LensModel || metadata.cameraData.lens;

    if (exif.exif) {
      if (Utils.isUInt32(exif.exif.ISO)) {
        metadata.cameraData.ISO = parseInt('' + exif.exif.ISO, 10);
      }
      if (Utils.isFloat32(exif.exif.FocalLength)) {
        metadata.cameraData.focalLength = parseFloat(
          '' + exif.exif.FocalLength
        );
      }
      if (Utils.isFloat32(exif.exif.ExposureTime)) {
        metadata.cameraData.exposure = parseFloat(
          parseFloat('' + exif.exif.ExposureTime).toFixed(6)
        );
      }
      if (Utils.isFloat32(exif.exif.FNumber)) {
        metadata.cameraData.fStop = parseFloat(
          parseFloat('' + exif.exif.FNumber).toFixed(2)
        );
      }
    }
    Utils.removeNullOrEmptyObj(metadata.cameraData);
    if (Object.keys(metadata.cameraData).length === 0) {
      delete metadata.cameraData;
    }
  }

  private static mapGPS(metadata: PhotoMetadata, exif: any) {
    try {
    if (exif.gps || (exif.exif && exif.exif.GPSLatitude && exif.exif.GPSLongitude)) {
      metadata.positionData = metadata.positionData || {};
      metadata.positionData.GPSData = metadata.positionData.GPSData || {};

      metadata.positionData.GPSData.longitude = Utils.isFloat32(exif.gps?.longitude) ? exif.gps.longitude : Utils.xmpExifGpsCoordinateToDecimalDegrees(exif.exif.GPSLongitude);
      metadata.positionData.GPSData.latitude = Utils.isFloat32(exif.gps?.latitude) ? exif.gps.latitude : Utils.xmpExifGpsCoordinateToDecimalDegrees(exif.exif.GPSLatitude);

      if (metadata.positionData.GPSData.longitude !== undefined) {
        metadata.positionData.GPSData.longitude = parseFloat(metadata.positionData.GPSData.longitude.toFixed(6))
      }
      if (metadata.positionData.GPSData.latitude !== undefined) {
        metadata.positionData.GPSData.latitude = parseFloat(metadata.positionData.GPSData.latitude.toFixed(6))
      }
    }
    } catch (err) {
      Logger.error(LOG_TAG, 'Error during reading of GPS data: ' + err);
    } finally {
      if (metadata.positionData) {
        Utils.removeNullOrEmptyObj(metadata.positionData);
        if (Object.keys(metadata.positionData).length === 0) {
          delete metadata.positionData;
        }
      }
    }
  }

  private static mapToponyms(metadata: PhotoMetadata, exif: any) {
    //Function to convert html code for special characters into their corresponding character (used in exif.photoshop-section)

    metadata.positionData = metadata.positionData || {};
    metadata.positionData.country = Utils.asciiToUTF8(exif.iptc?.Country) || Utils.decodeHTMLChars(exif.photoshop?.Country);
    metadata.positionData.state = Utils.asciiToUTF8(exif.iptc?.State) || Utils.decodeHTMLChars(exif.photoshop?.State);
    metadata.positionData.city = Utils.asciiToUTF8(exif.iptc?.City) || Utils.decodeHTMLChars(exif.photoshop?.City);
    if (metadata.positionData) {
      Utils.removeNullOrEmptyObj(metadata.positionData);
      if (Object.keys(metadata.positionData).length === 0) {
        delete metadata.positionData;
      }
    }
  }

  private static mapRating(metadata: PhotoMetadata, exif: any) {
    if (exif.xmp &&
      exif.xmp.Rating !== undefined) {
      const rting = Math.round(exif.xmp.Rating);
      if (rting <= 0) {
        //We map all ratings below 0 to 0. Lightroom supports value -1, but most other tools (including this) don't.
        //Rating 0 means "unrated" according to adobe's spec, so we delete the attribute in pigallery for the same effect
        delete metadata.rating;
      } else if (rting > 5) { //map all ratings above 5 to 5
        metadata.rating = 5;
      } else {
        metadata.rating = (rting as RatingTypes);
      }
    } 
  }

  private static mapFaces(metadata: PhotoMetadata, exif: any, orientation: number) {
    //xmp."mwg-rs" section
    if (exif["mwg-rs"] &&
      exif["mwg-rs"].Regions) {
      const faces: FaceRegion[] = [];
      const regionListVal = Array.isArray(exif["mwg-rs"].Regions.RegionList) ? exif["mwg-rs"].Regions.RegionList : [exif["mwg-rs"].Regions.RegionList];
      if (regionListVal) {
        for (const regionRoot of regionListVal) {
          let type;
          let name;
          let box;
          const createFaceBox = (
            w: string,
            h: string,
            x: string,
            y: string
          ) => {
            if (4 < orientation) { //roation is sidewards (90 or 270 degrees)
              [x, y] = [y, x];
              [w, h] = [h, w];
            }
            let swapX = 0;
            let swapY = 0;
            switch (orientation) {
              case 2: //TOP RIGHT (Mirror horizontal):
              case 6: //RIGHT TOP (Rotate 90 CW)
                swapX = 1;
                break;
              case 3: // BOTTOM RIGHT (Rotate 180)
              case 7: // RIGHT BOTTOM (Mirror horizontal and rotate 90 CW)
                swapX = 1;
                swapY = 1;
                break;
              case 4: //BOTTOM_LEFT (Mirror vertical)
              case 8: //LEFT_BOTTOM (Rotate 270 CW)
                swapY = 1;
                break;
            }
            // converting ratio to px
            return {
              width: Math.round(parseFloat(w) * metadata.size.width),
              height: Math.round(parseFloat(h) * metadata.size.height),
              left: Math.round(Math.abs(parseFloat(x) - swapX) * metadata.size.width),
              top: Math.round(Math.abs(parseFloat(y) - swapY) * metadata.size.height),
            };
          };
          /* Adobe Lightroom based face region structure */
          if (
            regionRoot &&
            regionRoot['rdf:Description'] &&
            regionRoot['rdf:Description'] &&
            regionRoot['rdf:Description']['mwg-rs:Area']
          ) {
            const region = regionRoot['rdf:Description'];
            const regionBox = region['mwg-rs:Area'].attributes;

            name = region['mwg-rs:Name'];
            type = region['mwg-rs:Type'];
            box = createFaceBox(
              regionBox['stArea:w'],
              regionBox['stArea:h'],
              regionBox['stArea:x'],
              regionBox['stArea:y']
            );
            /* Load exiftool edited face region structure, see github issue #191 */
          } else if (
            regionRoot &&
            regionRoot.Name &&
            regionRoot.Type &&
            regionRoot.Area
          ) {
            const regionBox = regionRoot.Area;
            name = regionRoot.Name;
            type = regionRoot.Type;
            box = createFaceBox(
              regionBox.w,
              regionBox.h,
              regionBox.x,
              regionBox.y
            );
          }

          if (type !== 'Face' || !name) {
            continue;
          }

          // convert center base box to corner based box
          box.left = Math.round(Math.max(0, box.left - box.width / 2));
          box.top = Math.round(Math.max(0, box.top - box.height / 2));


          faces.push({ name, box });
        }
      }
      if (faces.length > 0) {
        metadata.faces = faces; // save faces
        if (Config.Faces.keywordsToPersons) {
          // remove faces from keywords
          metadata.faces.forEach((f) => {
            const index = metadata.keywords.indexOf(f.name);
            if (index !== -1) {
              metadata.keywords.splice(index, 1);
            }
          });
        }
      }
    }
  }
}
