import {SharingDTO} from '../../../common/entities/SharingDTO';
import {SQLConnection} from './SQLConnection';
import {SharingEntity} from './enitites/SharingEntity';
import {Config} from '../../../common/config/private/Config';
import {PasswordHelper} from '../PasswordHelper';
import {DeleteResult, SelectQueryBuilder} from 'typeorm';
import {UserDTO} from '../../../common/entities/UserDTO';

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

  async listAll(): Promise<SharingDTO[]> {
    await SharingManager.removeExpiredLink();
    const connection = await SQLConnection.getConnection();
    return await connection
        .getRepository(SharingEntity)
        .createQueryBuilder('share')
        .leftJoinAndSelect('share.creator', 'creator')
        .getMany();
  }


  async listAllForDir(dir: string, user?: UserDTO): Promise<SharingDTO[]> {
    await SharingManager.removeExpiredLink();
    const connection = await SQLConnection.getConnection();
    const q: SelectQueryBuilder<SharingEntity> = connection
        .getRepository(SharingEntity)
        .createQueryBuilder('share')
        .leftJoinAndSelect('share.creator', 'creator')
        .where('path = :dir', {dir});
    if (user) {
      q.andWhere('share.creator = :user', {user: user.id});
    }
    return await q.getMany();
  }

  async findOne(sharingKey: string): Promise<SharingDTO> {
    await SharingManager.removeExpiredLink();
    const connection = await SQLConnection.getConnection();
    return await connection.getRepository(SharingEntity)
        .createQueryBuilder('share')
        .leftJoinAndSelect('share.creator', 'creator')
        .where('share.sharingKey = :sharingKey', {sharingKey})
        .getOne();
  }

  async createSharing(sharing: SharingDTO): Promise<SharingDTO> {
    await SharingManager.removeExpiredLink();
    const connection = await SQLConnection.getConnection();
    if (sharing.password) {
      sharing.password = PasswordHelper.cryptPassword(sharing.password);
    }
    return connection.getRepository(SharingEntity).save(sharing);
  }

  async updateSharing(
      inSharing: SharingDTO,
      forceUpdate: boolean
  ): Promise<SharingDTO> {
    const connection = await SQLConnection.getConnection();

    const sharing = await connection.getRepository(SharingEntity).findOneBy({
      id: inSharing.id,
      creator: inSharing.creator.id as unknown,
      path: inSharing.path,
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
    sharing.includeSubfolders = inSharing.includeSubfolders;
    sharing.expires = inSharing.expires;

    return connection.getRepository(SharingEntity).save(sharing);
  }
}
