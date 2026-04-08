import {UpdateSharingDTO} from '../../../common/entities/SharingDTO';
import {SQLConnection} from './SQLConnection';
import {SharingEntity} from './enitites/SharingEntity';
import {Config} from '../../../common/config/private/Config';
import {PasswordHelper} from '../PasswordHelper';
import {DeleteResult, SelectQueryBuilder} from 'typeorm';
import {UserDTO} from '../../../common/entities/UserDTO';
import {SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';

export class SharingManager {
  private static async removeExpiredLink(): Promise<DeleteResult> {
    const connection = await SQLConnection.getConnection();
    return await connection
      .getRepository(SharingEntity)
      .createQueryBuilder('share')
      .where('expires < :now', {now: Date.now()})
      .delete()
      .execute();
  }

  async deleteSharing(sharingKey: string): Promise<void> {
    const connection = await SQLConnection.getConnection();
    const sharing = await connection
      .getRepository(SharingEntity)
      .findOneBy({sharingKey});
    await connection.getRepository(SharingEntity).remove(sharing);
  }

  async listAll(): Promise<SharingEntity[]> {
    await SharingManager.removeExpiredLink();
    const connection = await SQLConnection.getConnection();
    return await connection
      .getRepository(SharingEntity)
      .createQueryBuilder('share')
      .leftJoinAndSelect('share.creator', 'creator')
      .getMany();
  }


  async listAllForQuery(query: SearchQueryDTO, user?: UserDTO): Promise<SharingEntity[]> {
    await SharingManager.removeExpiredLink();
    const connection = await SQLConnection.getConnection();
    const q: SelectQueryBuilder<SharingEntity> = connection
      .getRepository(SharingEntity)
      .createQueryBuilder('share')
      .leftJoinAndSelect('share.creator', 'creator')
      .where('share.searchQuery = :query', {query: SearchQueryUtils.stringifyForComparison(query)});
    if (user) {
      q.where('share.creator = :user', {user: user.id});
    }
    return await q.getMany();
  }

  async findOne(sharingKey: string): Promise<SharingEntity> {
    await SharingManager.removeExpiredLink();
    const connection = await SQLConnection.getConnection();
    return await connection.getRepository(SharingEntity)
      .createQueryBuilder('share')
      .leftJoinAndSelect('share.creator', 'creator')
      .where('share.sharingKey = :sharingKey', {sharingKey})
      .getOne();
  }

  async createSharing(sharing: UpdateSharingDTO): Promise<SharingEntity> {
    await SharingManager.removeExpiredLink();
    const connection = await SQLConnection.getConnection();
    if (sharing.password) {
      sharing.password = PasswordHelper.cryptPassword(sharing.password);
    }
    if (sharing.searchQuery) {
      SearchQueryUtils.validateSearchQuery(sharing.searchQuery);
      sharing.searchQuery = SearchQueryUtils.sortQuery(sharing.searchQuery);
    }
    return connection.getRepository(SharingEntity).save(sharing);
  }

  async updateSharing(
    inSharing: UpdateSharingDTO,
    forceUpdate: boolean
  ): Promise<SharingEntity> {
    const connection = await SQLConnection.getConnection();

    const sharing = await connection.getRepository(SharingEntity).findOneBy({
      id: inSharing.id,
      creator: inSharing.creator.id as unknown,
    });

    if (
      sharing.timeStamp < Date.now() - Config.Sharing.updateTimeout &&
      forceUpdate !== true
    ) {
      throw new Error('Sharing is locked, can\'t update anymore');
    }
    if (inSharing.password == null) {
      sharing.password = null;
    } else {
      sharing.password = PasswordHelper.cryptPassword(inSharing.password);
    }
    // allow updating searchQuery and canonicalize it
    sharing.searchQuery = SearchQueryUtils.sortQuery(inSharing.searchQuery);
    sharing.expires = inSharing.expires;

    return connection.getRepository(SharingEntity).save(sharing);
  }
}
