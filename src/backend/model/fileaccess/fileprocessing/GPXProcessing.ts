import * as path from 'path';
import {constants as fsConstants, promises as fsp} from 'fs';
import * as xml2js from 'xml2js';
import {ProjectPath} from '../../../ProjectPath';
import {Config} from '../../../../common/config/private/Config';
import {SupportedFormats} from '../../../../common/SupportedFormats';

type gpxEntry = { '$': { lat: string, lon: string }, ele?: string[], time?: string[], extensions?: unknown };

export class GPXProcessing {
  private static readonly GPX_FLOAT_ACCURACY = 6;

  public static isMetaFile(fullPath: string): boolean {
    const extension = path.extname(fullPath).toLowerCase();
    return SupportedFormats.WithDots.MetaFiles.indexOf(extension) !== -1;
  }

  public static isGPXFile(fullPath: string): boolean {
    const extension = path.extname(fullPath).toLowerCase();
    return extension === '.gpx';
  }

  public static generateConvertedPath(filePath: string): string {
    return path.join(
        ProjectPath.TranscodedFolder,
        ProjectPath.getRelativePathToImages(path.dirname(filePath)),
        path.basename(filePath)
        + '_' + Config.MetaFile.GPXCompressing.minDistance + 'm' +
        Config.MetaFile.GPXCompressing.minTimeDistance + 'ms' +
        Config.MetaFile.GPXCompressing.maxMiddleDeviance + 'm' +
        path.extname(filePath));
  }

  public static async isValidConvertedPath(
      convertedPath: string
  ): Promise<boolean> {
    const origFilePath = path.join(
        ProjectPath.ImageFolder,
        path.relative(
            ProjectPath.TranscodedFolder,
            convertedPath.substring(0, convertedPath.lastIndexOf('_'))
        )
    );


    try {
      await fsp.access(origFilePath, fsConstants.R_OK);
    } catch (e) {
      return false;
    }

    return true;
  }


  static async compressedGPXExist(
      filePath: string
  ): Promise<boolean> {
    // compressed gpx path
    const outPath = GPXProcessing.generateConvertedPath(filePath);

    // check if file already exist
    try {
      await fsp.access(outPath, fsConstants.R_OK);
      return true;
    } catch (e) {
      // ignoring errors
    }
    return false;
  }

  public static async compressGPX(
      filePath: string,
  ): Promise<string> {
    // generate compressed gpx path
    const outPath = GPXProcessing.generateConvertedPath(filePath);

    // check if file already exist
    try {
      await fsp.access(outPath, fsConstants.R_OK);
      return outPath;
    } catch (e) {
      // ignoring errors
    }


    const outDir = path.dirname(outPath);

    await fsp.mkdir(outDir, {recursive: true});
    const gpxStr = await fsp.readFile(filePath);
    const gpxObj = await (new xml2js.Parser()).parseStringPromise(gpxStr);

    if (gpxObj.gpx?.trk?.[0].trkseg[0]) { // only compress paths if there is any
      const distance = (entry1: gpxEntry, entry2: gpxEntry) => {
        const lat1 = parseFloat(entry1.$.lat);
        const lon1 = parseFloat(entry1.$.lon);
        const lat2 = parseFloat(entry2.$.lat);
        const lon2 = parseFloat(entry2.$.lon);

        // credits to: https://www.movable-type.co.uk/scripts/latlong.html
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const d = R * c; // in metres
        return d;
      };
      const gpxEntryFilter = (value: gpxEntry, i: number, list: gpxEntry[]) => {
        if (i === 0 || i >= list.length - 1) { // always keep the first and last items
          return true;
        }
        const timeDelta = (Date.parse(list[i]?.time?.[0]) - Date.parse(list[i - 1]?.time?.[0])); // mill sec.
        const dist = distance(list[i - 1], list[i]); // meters

        // if time is not available, consider it as all points are created the same time
        return !((isNaN(timeDelta) || timeDelta < Config.MetaFile.GPXCompressing.minTimeDistance) &&
            dist < Config.MetaFile.GPXCompressing.minDistance);
      };

      const postFilter = (i: number, list: gpxEntry[]) => {
        if (i === 0 || i >= list.length - 1) { // always keep the first and last items
          return true;
        }
        /* if point on the same line that the next and prev point would draw, lets skip it*/
        const avg = (a: string, b: string) => ((parseFloat(a) + parseFloat(b)) / 2).toFixed(this.GPX_FLOAT_ACCURACY);
        const modPoint: gpxEntry = {
          $: {
            lat: avg(list[i - 1].$.lat, list[i + 1].$.lat),
            lon: avg(list[i - 1].$.lon, list[i + 1].$.lon)
          }
        };
        if (list[i].time) {
          modPoint.time = list[i].time;
        }

        const deviation = distance(modPoint, list[i]); // meters
        return !(deviation < Config.MetaFile.GPXCompressing.maxMiddleDeviance); // keep if deviation is too big
      };

      for (let i = 0; i < gpxObj.gpx.trk.length; ++i) {
        for (let j = 0; j < gpxObj.gpx.trk[0].trkseg.length; ++j) {
          const trkseg: { trkpt: gpxEntry[] } = gpxObj.gpx.trk[i].trkseg[j];

          trkseg.trkpt = trkseg.trkpt.filter(gpxEntryFilter).map((v) => {
            v.$.lon = parseFloat(v.$.lon).toFixed(this.GPX_FLOAT_ACCURACY);
            v.$.lat = parseFloat(v.$.lat).toFixed(this.GPX_FLOAT_ACCURACY);
            delete v.ele;
            delete v.extensions;
            return v;
          });

          for (let i = 0; i < trkseg.trkpt.length; ++i) {
            if (!postFilter(i, trkseg.trkpt)) {
              trkseg.trkpt.splice(i, 1);
              --i;
            }
          }
        }
      }
    }
    await fsp.writeFile(outPath, (new xml2js.Builder({renderOpts: {pretty: false}})).buildObject(gpxObj));

    return outPath;
  }

}

