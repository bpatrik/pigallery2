import * as crypto from 'crypto';
import {DataStructureVersion} from '../../../common/DataStructureVersion';
import {SQLConnection} from './SQLConnection';
import {DirectoryEntity} from './enitites/DirectoryEntity';
import {MediaEntity} from './enitites/MediaEntity';
import {IObjectManager} from './IObjectManager';

export class VersionManager implements IObjectManager {
  private allMediaCount = 0;
  private latestDirectoryStatus: {
    name: string;
    lastModified: number;
    mediaCount: number;
  } = null;

  async getDataVersion(): Promise<string> {
    if (this.latestDirectoryStatus === null) {
      await this.onNewDataVersion();
    }

    if (!this.latestDirectoryStatus) {
      return DataStructureVersion.toString();
    }

    const versionString =
        DataStructureVersion +
        '_' +
        this.latestDirectoryStatus.name +
        '_' +
        this.latestDirectoryStatus.lastModified +
        '_' +
        this.latestDirectoryStatus.mediaCount +
        '_' +
        this.allMediaCount;
    return crypto.createHash('md5').update(versionString).digest('hex');
  }

  async onNewDataVersion(): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const dir = await connection
        .getRepository(DirectoryEntity)
        .createQueryBuilder('directory')
        .limit(1)
        .orderBy('directory.lastModified')
        .getOne();
    this.allMediaCount = await connection
        .getRepository(MediaEntity)
        .createQueryBuilder('media')
        .getCount();

    if (!dir) {
      return;
    }
    this.latestDirectoryStatus = {
      mediaCount: dir.mediaCount,
      lastModified: dir.lastModified,
      name: dir.name,
    };
  }
}
