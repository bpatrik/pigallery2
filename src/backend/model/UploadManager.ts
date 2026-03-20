import {ProjectPath} from '../ProjectPath';
import * as path from 'path';
import * as fs from 'fs';
import {SupportedFormats} from '../../common/SupportedFormats';
import {FileAlreadyExists} from '../exceptions/FileAlreadyExists';
import {ObjectManagers} from './ObjectManagers';
import {DiskManager} from './fileaccess/DiskManager';
import {Config} from '../../common/config/private/Config';

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
      const pg2confPath = path.join(fullDirPath, '.uploader.pg2conf');
      if (!fs.existsSync(pg2confPath)) {
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
    const fullDirPath = path.join(ProjectPath.ImageFolder, relativeDir);


    const extension = path.extname(file.originalname).toLowerCase().substring(1);
    if (!this.isSupportedExtension(extension)) {
      throw new Error('Unsupported file format: ' + extension);
    }

    const fullFilePath = path.join(fullDirPath, file.originalname);

    if (fs.existsSync(fullFilePath)) {
      throw new FileAlreadyExists('File already exists: ' + fullFilePath, file.originalname);
    }

    if (!fs.existsSync(fullDirPath)) {
      await fs.promises.mkdir(fullDirPath, {recursive: true});
    }

    await fs.promises.writeFile(fullFilePath, file.buffer);
  }

  private isSupportedExtension(ext: string): boolean {
    return SupportedFormats.Photos.includes(ext) ||
      SupportedFormats.Videos.includes(ext) ||
      SupportedFormats.MetaFiles.includes(ext);
  }
}
