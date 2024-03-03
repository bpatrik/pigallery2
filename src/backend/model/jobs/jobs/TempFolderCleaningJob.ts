import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import * as path from 'path';
import * as fs from 'fs';
import {Job} from './Job';
import {ProjectPath} from '../../../ProjectPath';
import {GPXProcessing} from '../../fileaccess/fileprocessing/GPXProcessing';
import {PhotoProcessing} from '../../fileaccess/fileprocessing/PhotoProcessing';
import {VideoProcessing} from '../../fileaccess/fileprocessing/VideoProcessing';
import { DynamicConfig } from '../../../../common/entities/DynamicConfig';

export class TempFolderCleaningJob extends Job {
  public readonly Name = DefaultsJobs[DefaultsJobs['Temp Folder Cleaning']];
  public readonly ConfigTemplate: DynamicConfig[] = null;
  public readonly Supported: boolean = true;
  directoryQueue: string[] = [];
  private tempRootCleaned = false;

  protected async init(): Promise<void> {
    this.tempRootCleaned = false;
    this.directoryQueue = [];
    this.directoryQueue.push(ProjectPath.TranscodedFolder);
  }

  protected async isValidFile(filePath: string): Promise<boolean> {
    if (PhotoProcessing.isPhoto(filePath)) {
      return PhotoProcessing.isValidConvertedPath(filePath);
    }

    if (VideoProcessing.isVideo(filePath)) {
      return VideoProcessing.isValidConvertedPath(filePath);
    }

    if (GPXProcessing.isMetaFile(filePath)) {
      return GPXProcessing.isValidConvertedPath(filePath);
    }

    return false;
  }

  protected async isValidDirectory(filePath: string): Promise<boolean> {
    const originalPath = path.join(
      ProjectPath.ImageFolder,
      path.relative(ProjectPath.TranscodedFolder, filePath)
    );
    try {
      await fs.promises.access(originalPath);
      return true;
    } catch (e) {
      // ignoring errors
    }
    return false;
  }

  protected async readDir(dirPath: string): Promise<string[]> {
    return (await fs.promises.readdir(dirPath)).map((f) =>
      path.normalize(path.join(dirPath, f))
    );
  }

  protected async stepTempDirectory(): Promise<boolean> {
    const files = await this.readDir(ProjectPath.TempFolder);
    const validFiles = [ProjectPath.TranscodedFolder, ProjectPath.FacesFolder];
    for (const file of files) {
      if (validFiles.indexOf(file) === -1) {
        this.Progress.log('processing: ' + file);
        this.Progress.Processed++;
        if ((await fs.promises.stat(file)).isDirectory()) {
          await fs.promises.rm(file, {recursive: true});
        } else {
          await fs.promises.unlink(file);
        }
      } else {
        this.Progress.log('skipping: ' + file);
        this.Progress.Skipped++;
      }
    }

    return true;
  }

  protected async stepConvertedDirectory(): Promise<boolean> {
    const filePath = this.directoryQueue.shift();
    const stat = await fs.promises.stat(filePath);

    this.Progress.Left = this.directoryQueue.length;
    if (stat.isDirectory()) {
      if ((await this.isValidDirectory(filePath)) === false) {
        this.Progress.log('processing: ' + filePath);
        this.Progress.Processed++;
        await fs.promises.rm(filePath, {recursive: true});
      } else {
        this.Progress.log('skipping: ' + filePath);
        this.Progress.Skipped++;
        this.directoryQueue = this.directoryQueue.concat(
          await this.readDir(filePath)
        );
      }
    } else {
      if ((await this.isValidFile(filePath)) === false) {
        this.Progress.log('processing: ' + filePath);
        this.Progress.Processed++;
        await fs.promises.unlink(filePath);
      } else {
        this.Progress.log('skipping: ' + filePath);
        this.Progress.Skipped++;
      }
    }
    return true;
  }

  protected async step(): Promise<boolean> {
    if (this.directoryQueue.length === 0) {
      this.Progress.Left = 0;
      return false;
    }
    if (this.tempRootCleaned === false) {
      this.tempRootCleaned = true;
      return this.stepTempDirectory();
    }
    return this.stepConvertedDirectory();
  }
}
