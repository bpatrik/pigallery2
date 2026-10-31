import {ProjectPath} from '../ProjectPath';
import * as path from 'path';
import * as fs from 'fs';
import {UploadUtils} from '../../common/UploadUtils';
import {FileAlreadyExists} from '../exceptions/FileAlreadyExists';
import {ObjectManagers} from './ObjectManagers';
import {DiskManager} from './fileaccess/DiskManager';
import {Config} from '../../common/config/private/Config';
import {PG2ConfMap} from '../../common/PG2ConfMap';

export interface UploadError {
  filename: string;
  error: string;
}

export class UploadManager {

  public async saveFiles(directory: string, files: Express.Multer.File[]): Promise<UploadError[]> {
    if (Config.Upload.enabled === false) {
      throw new Error('Upload is disabled');
    }
    const relativeDir = directory || '';
    const fullDirPath = path.join(ProjectPath.ImageFolder, relativeDir);

    if (Config.Upload.enforcedDirectoryConfig === true) {
      const hasUploadConf = Object.keys(PG2ConfMap.upload).some(filename => {
        const pg2confPath = path.join(fullDirPath, filename);
        return fs.existsSync(pg2confPath);
      });
      if (!hasUploadConf) {
        throw new Error('Upload is not enabled in this directory');
      }
    }

    const errors: UploadError[] = [];
    for (const file of files) {
      try {
        await this.saveFile(directory, file);
      } catch (e) {
        errors.push({filename: file.originalname, error: e.message});
      }
    }
    const dto = DiskManager.getDTOFromPath(directory || '');
    await ObjectManagers.getInstance().onDataChange(dto);

    return errors;
  }

  public async saveFile(directory: string, file: Express.Multer.File): Promise<void> {
    const relativeDir = directory || '';
    const fullDirPath = path.resolve(path.join(ProjectPath.ImageFolder, relativeDir));

    const filename = file.originalname;
    // the filename must be a plain name, no path components
    if (!filename || filename === '.' || filename === '..' ||
      /[/\\\0]/.test(filename) || path.basename(filename) !== filename) {
      throw new Error('Invalid filename: ' + filename);
    }

    const extension = UploadUtils.getExtension(filename);
    if (!UploadUtils.isUploadableExtension(extension, Config.Upload.blockedExtensions)) {
      throw new Error('Unsupported file format: ' + extension);
    }

    const fullFilePath = path.join(fullDirPath, filename);
    const imageFolder = path.resolve(ProjectPath.ImageFolder);
    if (fullFilePath.indexOf(imageFolder + path.sep) !== 0) {
      throw new Error('Invalid upload path: ' + filename);
    }

    if (fs.existsSync(fullFilePath)) {
      throw new FileAlreadyExists('File already exists: ' + fullFilePath, file.originalname);
    }

    if (!fs.existsSync(fullDirPath)) {
      await fs.promises.mkdir(fullDirPath, {recursive: true});
    }

    await fs.promises.writeFile(fullFilePath, file.buffer);
  }
}
