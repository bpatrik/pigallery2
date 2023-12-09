import {expect} from 'chai';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {SharingManager} from '../../../../../src/backend/model/database/SharingManager';
import {SharingDTO} from '../../../../../src/common/entities/SharingDTO';
import {UserEntity} from '../../../../../src/backend/model/database/enitites/UserEntity';
import {UserDTO, UserRoles} from '../../../../../src/common/entities/UserDTO';
import {DBTestHelper} from '../../../DBTestHelper';

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
describe = DBTestHelper.describe();

describe('SharingManager', (sqlHelper: DBTestHelper) => {


  let creator: UserDTO = null;

  const setUpSqlDB = async () => {
    await sqlHelper.initDB();

    const conn = await SQLConnection.getConnection();

    creator = await conn.getRepository(UserEntity).save({
      id: null,
      name: 'test use',
      password: '',
      role: UserRoles.User,
      permissions: null
    });

    await SQLConnection.close();
  };


  beforeEach(async () => {
    await setUpSqlDB();
  });

  after(async () => {
    await sqlHelper.clearDB();
  });


  it('should create sharing', async () => {
    const sm = new SharingManager();

    const sharing: SharingDTO = {
      id: null,
      sharingKey: 'testKey',
      path: '/',
      password: null,
      creator,
      expires: Date.now() + 1000,
      includeSubfolders: true,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    expect(saved.id).to.not.equals(null);
    expect(saved.creator.id).to.equals(creator.id);
    expect(saved.sharingKey).to.equals(sharing.sharingKey);
    expect(saved.timeStamp).to.equals(sharing.timeStamp);
    expect(saved.password).to.equals(sharing.password);
    expect(saved.expires).to.equals(sharing.expires);
    expect(saved.includeSubfolders).to.equals(sharing.includeSubfolders);
  });


  it('should find sharing', async () => {
    const sm = new SharingManager();

    const sharing: SharingDTO = {
      id: null,
      sharingKey: 'testKey',
      path: '/',
      password: null,
      creator,
      expires: Date.now() + 1000,
      includeSubfolders: true,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    const found = await sm.findOne('testKey');

    expect(found.id).to.not.equals(null);
    expect(found.sharingKey).to.equals(sharing.sharingKey);
    expect(found.timeStamp).to.equals(sharing.timeStamp);
    expect(found.password).to.equals(sharing.password);
    expect(found.expires).to.equals(sharing.expires);
  });


  it('should update sharing', async () => {
    const sm = new SharingManager();

    const sharing: SharingDTO = {
      id: null,
      sharingKey: 'testKey',
      path: '/',
      password: null,
      creator,
      expires: Date.now() + 1000,
      includeSubfolders: true,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    expect(saved.password).to.equals(sharing.password);
    expect(saved.expires).to.equals(sharing.expires);
    expect(saved.includeSubfolders).to.equals(sharing.includeSubfolders);

    const update: SharingDTO = {
      id: saved.id,
      sharingKey: saved.sharingKey,
      path: saved.path,
      password: null,
      creator,
      expires: Date.now() + 2000,
      includeSubfolders: false,
      timeStamp: Date.now()
    };
    const updated = await sm.updateSharing(update, false);

    expect(updated.id).to.equals(saved.id);
    expect(updated.sharingKey).to.equals(sharing.sharingKey);
    expect(updated.timeStamp).to.equals(sharing.timeStamp);
    expect(updated.password).to.equals(update.password);
    expect(updated.expires).to.equals(update.expires);
    expect(updated.includeSubfolders).to.equals(update.includeSubfolders);
  });

});
