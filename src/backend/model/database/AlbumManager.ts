import {SQLConnection} from './SQLConnection';
import {AlbumBaseEntity} from './enitites/album/AlbumBaseEntity';
import {AlbumBaseDTO} from '../../../common/entities/album/AlbumBaseDTO';
import {SavedSearchDTO} from '../../../common/entities/album/SavedSearchDTO';
import {ObjectManagers} from '../ObjectManagers';
import {SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';
import {SavedSearchEntity} from './enitites/album/SavedSearchEntity';
import {Logger} from '../../Logger';
import {IObjectManager} from './IObjectManager';

const LOG_TAG = '[AlbumManager]';

export class AlbumManager implements IObjectManager {
  /**
   * Person table contains denormalized data that needs to update when isDBValid = false
   */
  private isDBValid = false;

  private static async updateAlbum(album: SavedSearchEntity): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const cover =
        await ObjectManagers.getInstance().CoverManager.getCoverForAlbum(album);
    const count = await
        ObjectManagers.getInstance().SearchManager.getCount((album as SavedSearchDTO).searchQuery);

    await connection
        .createQueryBuilder()
        .update(AlbumBaseEntity)
        .set({cover: cover, count})
        .where('id = :id', {id: album.id})
        .execute();
  }

  public async addIfNotExistSavedSearch(
      name: string,
      searchQuery: SearchQueryDTO,
      lockedAlbum: boolean
  ): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const album = await connection
        .getRepository(SavedSearchEntity)
        .findOneBy({name, searchQuery});
    if (album) {
      return;
    }
    await this.addSavedSearch(name, searchQuery, lockedAlbum);
  }

  public async addSavedSearch(
      name: string,
      searchQuery: SearchQueryDTO,
      lockedAlbum?: boolean
  ): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const a = await connection
        .getRepository(SavedSearchEntity)
        .save({name, searchQuery, locked: lockedAlbum});
    await AlbumManager.updateAlbum(a);
  }

  public async deleteAlbum(id: number): Promise<void> {
    const connection = await SQLConnection.getConnection();

    if (
        (await connection
            .getRepository(AlbumBaseEntity)
            .countBy({id, locked: false})) !== 1
    ) {
      throw new Error('Could not delete album, id:' + id);
    }

    await connection
        .getRepository(AlbumBaseEntity)
        .delete({id, locked: false});
  }

  public async getAlbums(): Promise<AlbumBaseDTO[]> {
    await this.updateAlbums();
    const connection = await SQLConnection.getConnection();
    return await connection
        .getRepository(AlbumBaseEntity)
        .createQueryBuilder('album')
        .leftJoin('album.cover', 'cover')
        .leftJoin('cover.directory', 'directory')
        .select(['album', 'cover.name', 'directory.name', 'directory.path'])
        .getMany();
  }

  public async onNewDataVersion(): Promise<void> {
    await this.resetCovers();
  }

  public async resetCovers(): Promise<void> {
    this.isDBValid = false;
  }

  private async updateAlbums(): Promise<void> {
    if (this.isDBValid === true) {
      return;
    }
    Logger.debug(LOG_TAG, 'Updating derived album data');
    const connection = await SQLConnection.getConnection();
    const albums = await connection.getRepository(AlbumBaseEntity).find();

    for (const a of albums) {
      await AlbumManager.updateAlbum(a as SavedSearchEntity);
      // giving back the control to the main event loop (Macrotask queue)
      // https://blog.insiderattack.net/promises-next-ticks-and-immediates-nodejs-event-loop-part-3-9226cbe7a6aa
      await new Promise(setImmediate);
    }
    this.isDBValid = true;
  }

  async deleteAll() {
    const connection = await SQLConnection.getConnection();
    await connection
        .getRepository(AlbumBaseEntity)
        .createQueryBuilder('album')
        .delete()
        .execute();
  }
}
