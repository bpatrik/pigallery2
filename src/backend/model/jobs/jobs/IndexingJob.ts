import {ObjectManagers} from '../../ObjectManagers';
import * as path from 'path';
import * as fs from 'fs';
import {Job} from './Job';
import {DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import {JobProgressStates} from '../../../../common/entities/job/JobProgressDTO';
import {ProjectPath} from '../../../ProjectPath';
import {backendTexts} from '../../../../common/BackendTexts';
import {ParentDirectoryDTO} from '../../../../common/entities/DirectoryDTO';
import {Logger} from '../../../Logger';
import {FileDTO} from '../../../../common/entities/FileDTO';
import {DiskManager} from '../../fileaccess/DiskManager';
import {DynamicConfig} from '../../../../common/entities/DynamicConfig';

const LOG_TAG = '[IndexingJob]';

export class IndexingJob<
    S extends { indexChangesOnly: boolean } = { indexChangesOnly: boolean }
> extends Job<S> {
  public readonly Name = DefaultsJobs[DefaultsJobs.Indexing];
  directoriesToIndex: string[] = [];
  public readonly ConfigTemplate: DynamicConfig[] = [
    {
      id: 'indexChangesOnly',
      type: 'boolean',
      name: backendTexts.indexChangesOnly.name,
      description: backendTexts.indexChangesOnly.description,
      defaultValue: true,
    },
  ];

  public get Supported(): boolean {
    return true;
  }

  protected async init(): Promise<void> {
    this.directoriesToIndex.push('/');
  }

  protected async step(): Promise<boolean> {
    if (this.directoriesToIndex.length === 0) {
      if (ObjectManagers.getInstance().IndexingManager.IsSavingInProgress) {
        await ObjectManagers.getInstance().IndexingManager.SavingReady;
      }
      this.Progress.Left = 0;
      return false;
    }
    const directory = this.directoriesToIndex.shift();
    this.Progress.Left = this.directoriesToIndex.length;

    let scanned: ParentDirectoryDTO<FileDTO>;
    let dirChanged = true;

    try {

      const absDirPath = path.join(ProjectPath.ImageFolder, directory);
      if (!fs.existsSync(absDirPath)) {
        this.Progress.log('Skipping. Directory does not exist: ' + directory);
        this.Progress.Skipped++;
      } else { // dir should exist now

        // check if the folder got modified if only changes need to be indexed
        if (this.config.indexChangesOnly) {

          const stat = fs.statSync(absDirPath);
          const lastModified = DiskManager.calcLastModified(stat);
          scanned = await ObjectManagers.getInstance().GalleryManager.selectDirStructure(directory);
          // If not modified and it was scanned before, dir is up-to-date
          if (
              scanned &&
              scanned.lastModified === lastModified &&
              scanned.lastScanned != null
          ) {
            dirChanged = false;
          }
        }


        // reindex
        if (dirChanged || !this.config.indexChangesOnly) {
          this.Progress.log('Indexing: ' + directory);
          this.Progress.Processed++;
          scanned =
              await ObjectManagers.getInstance().IndexingManager.indexDirectory(
                  directory
              );
        } else {
          this.Progress.log('Skipping. No change for: ' + directory);
          this.Progress.Skipped++;
          Logger.silly(LOG_TAG, 'Skipping reindexing, no change for: ' + directory);
        }
      }
    } catch (e) {
      this.Progress.log('Skipping. Indexing failed for: ' + directory);
      this.Progress.Skipped++;
      Logger.warn(LOG_TAG, 'Skipping. Indexing failed for: ' + directory);
      console.error(e);
    }
    if (this.Progress.State !== JobProgressStates.running) {
      return false;
    }
    for (const item of scanned.directories) {
      this.directoriesToIndex.push(path.join(item.path, item.name));
    }
    return true;
  }
}
