import {ProjectPath} from '../ProjectPath';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {UploadUtils} from '../../common/UploadUtils';
import {FileAlreadyExists} from '../exceptions/FileAlreadyExists';
import {ObjectManagers} from './ObjectManagers';
import {DiskManager} from './fileaccess/DiskManager';
import {Config} from '../../common/config/private/Config';
import {PG2ConfMap} from '../../common/PG2ConfMap';
import {FolderNotWritable} from '../exceptions/FolderNotWritable';

export interface UploadError {
  filename: string;
  error: string;
}

// saved by multer to the temp folder; tooLarge: above Upload.maxFileSizeMB, nothing is saved then
export type UploadedFile = Express.Multer.File & { tooLarge?: boolean };

// the disk refuses to write to the folder: every file would fail the same way
const NOT_WRITABLE = ['EACCES', 'EPERM', 'EROFS'];

export class UploadManager {

  public async saveFiles(directory: string, files: UploadedFile[]): Promise<UploadError[]> {
    if (Config.Upload.enabled === false) {
      throw new FolderNotWritable('Upload is disabled');
    }
    const fullDirPath = ProjectPath.resolveInImageFolder(directory);
    if (!fullDirPath) {
      throw new FolderNotWritable('Invalid upload path: ' + directory);
    }

    if (Config.Upload.enforcedDirectoryConfig === true) {
      const hasUploadConf = Object.keys(PG2ConfMap.upload).some(filename => {
        const pg2confPath = path.join(fullDirPath, filename);
        return fs.existsSync(pg2confPath);
      });
      if (!hasUploadConf) {
        throw new FolderNotWritable('Upload is not enabled in this directory');
      }
    }

    const errors: UploadError[] = [];
    for (const file of files) {
      try {
        await this.saveFile(directory, file);
      } catch (e) {
        if (NOT_WRITABLE.includes((e as NodeJS.ErrnoException).code ?? '')) {
          throw new FolderNotWritable('Cannot write to ' + directory + ': ' + (e as Error).message);
        }
        errors.push({filename: file.originalname, error: e instanceof Error ? e.message : String(e)});
      }
    }
    const dto = DiskManager.getDTOFromPath(directory || '');
    await ObjectManagers.getInstance().onDataChange(dto);

    return errors;
  }

  public async saveFile(directory: string, file: UploadedFile): Promise<void> {
    const fullDirPath = ProjectPath.resolveInImageFolder(directory);
    if (!fullDirPath) {
      throw new Error('Invalid upload path: ' + directory);
    }

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

    if (file.tooLarge) {
      throw new Error('File is larger than the upload limit of ' + Config.Upload.maxFileSizeMB + ' MB: ' + filename);
    }

    if (fs.existsSync(fullFilePath)) {
      throw new FileAlreadyExists('File already exists: ' + fullFilePath, file.originalname);
    }

    if (!fs.existsSync(fullDirPath)) {
      await fs.promises.mkdir(fullDirPath, {recursive: true});
    }

    try {
      await fs.promises.rename(file.path, fullFilePath);
    } catch (e) {
      // the temp folder is on another disk (e.g. another docker volume)
      if ((e as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw e;
      }
      await fs.promises.copyFile(file.path, fullFilePath, fs.constants.COPYFILE_EXCL);
      await fs.promises.rm(file.path, {force: true});
    }
  }
}
