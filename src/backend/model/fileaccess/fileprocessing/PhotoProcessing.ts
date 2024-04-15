import * as path from 'path';
import {constants as fsConstants, promises as fsp} from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import {ProjectPath} from '../../../ProjectPath';
import {Config} from '../../../../common/config/private/Config';
import {MediaRendererInput, PhotoWorker, SvgRendererInput, ThumbnailSourceType,} from '../PhotoWorker';
import {ITaskExecuter, TaskExecuter} from '../TaskExecuter';
import {FaceRegion, PhotoDTO} from '../../../../common/entities/PhotoDTO';
import {SupportedFormats} from '../../../../common/SupportedFormats';
import {PersonEntry} from '../../database/enitites/PersonEntry';
import {SVGIconConfig} from '../../../../common/config/public/ClientConfig';

export class PhotoProcessing {
  private static initDone = false;
  private static taskQue: ITaskExecuter<MediaRendererInput | SvgRendererInput, void> = null;
  private static readonly CONVERTED_EXTENSION = '.webp';

  public static init(): void {
    if (this.initDone === true) {
      return;
    }

    Config.Media.Photo.concurrentThumbnailGenerations = Math.max(
      1,
      os.cpus().length - 1
    );

    this.taskQue = new TaskExecuter(
      Config.Media.Photo.concurrentThumbnailGenerations,
      (input): Promise<void> => PhotoWorker.render(input)
    );

    this.initDone = true;
  }

  public static async generatePersonThumbnail(
    person: PersonEntry
  ): Promise<string> {
    // load parameters
    const photo: PhotoDTO = person.sampleRegion.media;
    const mediaPath = path.join(
      ProjectPath.ImageFolder,
      photo.directory.path,
      photo.directory.name,
      photo.name
    );
    const size: number = Config.Media.Photo.personThumbnailSize;
    const faceRegion = person.sampleRegion.media.metadata.faces.find(f => f.name === person.name);
    // generate thumbnail path
    const thPath = PhotoProcessing.generatePersonThumbnailPath(
      mediaPath,
      faceRegion,
      size
    );

    // check if thumbnail already exist
    try {
      await fsp.access(thPath, fsConstants.R_OK);
      return thPath;
    } catch (e) {
      // ignoring errors
    }

    const margin = {
      x: Math.round(
        faceRegion.box.width *
        Config.Media.Photo.personFaceMargin
      ),
      y: Math.round(
        faceRegion.box.height *
        Config.Media.Photo.personFaceMargin
      ),
    };

    // run on other thread
    const input = {
      type: ThumbnailSourceType.Photo,
      mediaPath,
      size,
      outPath: thPath,
      makeSquare: false,
      cut: {
        left: Math.round(
          Math.max(0, faceRegion.box.left - margin.x / 2)
        ),
        top: Math.round(
          Math.max(0, faceRegion.box.top - margin.y / 2)
        ),
        width: faceRegion.box.width + margin.x,
        height: faceRegion.box.height + margin.y,
      },
      useLanczos3: Config.Media.Photo.useLanczos3,
      quality: Config.Media.Photo.quality,
      smartSubsample: Config.Media.Photo.smartSubsample,
    } as MediaRendererInput;
    input.cut.width = Math.min(
      input.cut.width,
      photo.metadata.size.width - input.cut.left
    );
    input.cut.height = Math.min(
      input.cut.height,
      photo.metadata.size.height - input.cut.top
    );

    await fsp.mkdir(ProjectPath.FacesFolder, {recursive: true});
    await PhotoProcessing.taskQue.execute(input);
    return thPath;
  }

  public static generateConvertedPath(mediaPath: string, size: number): string {
    const file = path.basename(mediaPath);
    const animated = Config.Media.Photo.animateGif && path.extname(mediaPath).toLowerCase() == '.gif';
    return path.join(
      ProjectPath.TranscodedFolder,
      ProjectPath.getRelativePathToImages(path.dirname(mediaPath)),
      file + '_' + size + 'q' + Config.Media.Photo.quality +
      (animated ? 'anim' : '') +
      (Config.Media.Photo.smartSubsample ? 'cs' : '') +
      PhotoProcessing.CONVERTED_EXTENSION
    );
  }

  public static generatePersonThumbnailPath(
    mediaPath: string,
    faceRegion: FaceRegion,
    size: number
  ): string {
    return path.join(
      ProjectPath.FacesFolder,
      crypto
        .createHash('md5')
        .update(
          mediaPath +
          '_' +
          faceRegion.name +
          '_' +
          faceRegion.box.left +
          '_' +
          faceRegion.box.top
        )
        .digest('hex') +
      '_' +
      size +
      '_' + Config.Media.Photo.personFaceMargin +
      PhotoProcessing.CONVERTED_EXTENSION
    );
  }

  /**
   * Tells if the path is valid with the current config
   * @param convertedPath
   */
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

    if (path.extname(convertedPath) !== PhotoProcessing.CONVERTED_EXTENSION) {
      return false;
    }
    let nextIndex = convertedPath.lastIndexOf('_') + 1;

    const sizeStr = convertedPath.substring(
      nextIndex,
      convertedPath.lastIndexOf('q')
    );
    nextIndex = convertedPath.lastIndexOf('q') + 1;

    const size = parseInt(sizeStr, 10);

    if (
      (size + '').length !== sizeStr.length ||
      (Config.Media.Photo.thumbnailSizes.indexOf(size) === -1)
    ) {
      return false;
    }

    const qualityStr =convertedPath.substring(nextIndex,
      nextIndex+convertedPath.substring(nextIndex).search(/[A-Za-z]/)); // end of quality string

    const quality = parseInt(qualityStr, 10);

    if ((quality + '').length !== qualityStr.length ||
      quality !== Config.Media.Photo.quality) {
      return false;
    }


    nextIndex += qualityStr.length;


    const lowerExt = path.extname(origFilePath).toLowerCase();
    const shouldBeAnimated = Config.Media.Photo.animateGif && lowerExt == '.gif';
    if (shouldBeAnimated) {
      if (convertedPath.substring(
        nextIndex,
        nextIndex + 'anim'.length
      ) != 'anim') {
        return false;
      }
      nextIndex += 'anim'.length;
    }


    if (Config.Media.Photo.smartSubsample) {
      if (convertedPath.substring(
        nextIndex,
        nextIndex + 2
      ) != 'cs') {
        return false;
      }
      nextIndex+=2;
    }

    if(convertedPath.substring(
      nextIndex
    ).toLowerCase() !== path.extname(convertedPath)){
      return false;
    }


    try {
      await fsp.access(origFilePath, fsConstants.R_OK);
    } catch (e) {
      return false;
    }

    return true;
  }


  static async convertedPhotoExist(
    mediaPath: string,
    size: number
  ): Promise<boolean> {
    // generate thumbnail path
    const outPath = PhotoProcessing.generateConvertedPath(mediaPath, size);

    // check if file already exist
    try {
      await fsp.access(outPath, fsConstants.R_OK);
      return true;
    } catch (e) {
      // ignoring errors
    }
    return false;
  }


  public static async generateThumbnail(
    mediaPath: string,
    size: number,
    sourceType: ThumbnailSourceType,
    makeSquare: boolean
  ): Promise<string> {
    // generate thumbnail path
    const outPath = PhotoProcessing.generateConvertedPath(mediaPath, size);

    // check if file already exist
    try {
      await fsp.access(outPath, fsConstants.R_OK);
      return outPath;
    } catch (e) {
      // ignoring errors
    }

    // run on other thread
    const input = {
      type: sourceType,
      mediaPath,
      size,
      outPath,
      makeSquare,
      useLanczos3: Config.Media.Photo.useLanczos3,
      quality: Config.Media.Photo.quality,
      smartSubsample: Config.Media.Photo.smartSubsample,
    } as MediaRendererInput;

    const outDir = path.dirname(input.outPath);

    await fsp.mkdir(outDir, {recursive: true});
    await this.taskQue.execute(input);
    return outPath;
  }

  public static isPhoto(fullPath: string): boolean {
    const extension = path.extname(fullPath).toLowerCase();
    return SupportedFormats.WithDots.Photos.indexOf(extension) !== -1;
  }

  public static async renderSVG(
    svgIcon: SVGIconConfig,
    outPath: string,
    color = '#000'
  ): Promise<string> {

    // check if file already exist
    try {
      await fsp.access(outPath, fsConstants.R_OK);
      return outPath;
    } catch (e) {
      // ignoring errors
    }

    const size = 256;
    // run on other thread
    const input = {
      type: ThumbnailSourceType.Photo,
      svgString: `<svg fill="${color}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"
viewBox="${svgIcon.viewBox || '0 0 512 512'}">d="${svgIcon.items}</svg>`,
      size: size,
      outPath,
      makeSquare: false,
      animate: false,
      useLanczos3: Config.Media.Photo.useLanczos3,
      quality: Config.Media.Photo.quality,
      smartSubsample: Config.Media.Photo.smartSubsample,
    } as SvgRendererInput;

    const outDir = path.dirname(input.outPath);

    await fsp.mkdir(outDir, {recursive: true});
    await this.taskQue.execute(input);
    return outPath;
  }

}

