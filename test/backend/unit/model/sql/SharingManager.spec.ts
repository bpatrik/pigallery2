import {expect} from 'chai';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {SharingManager} from '../../../../../src/backend/model/database/SharingManager';
import {UpdateSharingDTO} from '../../../../../src/common/entities/SharingDTO';
import {UserEntity} from '../../../../../src/backend/model/database/enitites/UserEntity';
import {UserDTO, UserRoles} from '../../../../../src/common/entities/UserDTO';
import {DBTestHelper} from '../../../DBTestHelper';
import {DirectorySearch, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../src/common/entities/SearchQueryDTO';
import {TestHelper} from '../../../../TestHelper';

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
describe = DBTestHelper.describe();

describe('SharingManager', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);


  let creator: UserDTO = null;

  const setUpSqlDB = async () => {
    await sqlHelper.initDB();

    const conn = await SQLConnection.getConnection();

    creator = await conn.getRepository(UserEntity).save({
      id: null,
      name: 'test use',
      password: '',
      role: UserRoles.User
    });

    await SQLConnection.close();
  };


  beforeEach(async () => {
    await setUpSqlDB();
  });

  after(sqlHelper.clearDB);


  it('should create sharing', async () => {
    const sm = new SharingManager();

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKey',
      searchQuery: {value: '/', type: SearchQueryTypes.directory} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 1000,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    expect(saved.id).to.not.equals(null);
    expect(saved.creator.id).to.equals(creator.id);
    expect(saved.sharingKey).to.equals(sharing.sharingKey);
    expect(saved.timeStamp).to.equals(sharing.timeStamp);
    expect(saved.password).to.equals(sharing.password);
    expect(saved.expires).to.equals(sharing.expires);
  });


  it('should find sharing', async () => {
    const sm = new SharingManager();

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKey',
      searchQuery: {value: '/', type: SearchQueryTypes.directory} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 1000,
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

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKey',
      searchQuery: {value: '/', type: SearchQueryTypes.directory} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 1000,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    expect(saved.password).to.equals(sharing.password);
    expect(saved.expires).to.equals(sharing.expires);

    const update: UpdateSharingDTO = {
      id: saved.id,
      sharingKey: saved.sharingKey,
      searchQuery: saved.searchQuery,
      password: null,
      creator,
      expires: Date.now() + 2000,
      timeStamp: Date.now()
    };
    const updated = await sm.updateSharing(update, false);

    expect(updated.id).to.equals(saved.id);
    expect(updated.sharingKey).to.equals(sharing.sharingKey);
    expect(updated.timeStamp).to.equals(sharing.timeStamp);
    expect(updated.password).to.equals(update.password);
    expect(updated.expires).to.equals(update.expires);
  });

  it('should create sharing with defaultDirectoryView', async () => {
    const sm = new SharingManager();

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKeyWithDirDefault',
      searchQuery: {value: '/vacation*', type: SearchQueryTypes.directory} as TextSearch,
      defaultDirectoryView: '/vacation',
      password: null,
      creator,
      expires: Date.now() + 1000,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    expect(saved.id).to.not.equals(null);
    expect(saved.searchQuery).to.deep.equals(sharing.searchQuery);
    expect(saved.defaultDirectoryView).to.equals('/vacation');
    expect(saved.defaultSearchView == null).to.be.true;

    const found = await sm.findOne('testKeyWithDirDefault');
    expect(found.id).to.equals(saved.id);
    expect(found.searchQuery).to.deep.equals(sharing.searchQuery);
    expect(found.defaultDirectoryView).to.equals('/vacation');
    expect(found.defaultSearchView == null).to.be.true;
  });

  it('should create sharing with defaultSearchView and not overwrite searchQuery', async () => {
    const sm = new SharingManager();

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKeyWithSearchDefault',
      searchQuery: {value: '/vacation*', type: SearchQueryTypes.directory} as TextSearch,
      defaultSearchView: {value: 'sunset', type: SearchQueryTypes.keyword} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 1000,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    expect(saved.id).to.not.equals(null);
    expect(saved.searchQuery).to.deep.equals(sharing.searchQuery);
    expect(saved.defaultSearchView).to.deep.equals(sharing.defaultSearchView);
    expect(saved.defaultDirectoryView == null).to.be.true;

    const found = await sm.findOne('testKeyWithSearchDefault');
    expect(found.id).to.equals(saved.id);
    expect(found.searchQuery).to.deep.equals(sharing.searchQuery);
    expect(found.defaultSearchView).to.deep.equals(sharing.defaultSearchView);
    expect(found.defaultDirectoryView == null).to.be.true;
  });

  it('should fail to create sharing if both defaultDirectoryView and defaultSearchView are set', async () => {
    const sm = new SharingManager();

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKeyWithBothDefaults',
      searchQuery: {value: '/vacation*', type: SearchQueryTypes.directory} as TextSearch,
      defaultDirectoryView: '/vacation',
      defaultSearchView: {value: 'sunset', type: SearchQueryTypes.keyword} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 1000,
      timeStamp: Date.now()
    };

    try {
      await sm.createSharing(sharing);
      expect.fail('should have thrown error');
    } catch (err) {
      expect(err.message).to.contain('cannot be set at the same time');
    }
  });

  it('should update sharing with defaultDirectoryView', async () => {
    const sm = new SharingManager();

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKeyUpdateDir',
      searchQuery: {value: '/vacation*', type: SearchQueryTypes.directory} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 1000,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    expect(saved.defaultDirectoryView == null).to.be.true;
    expect(saved.defaultSearchView == null).to.be.true;

    const update: UpdateSharingDTO = {
      id: saved.id,
      sharingKey: saved.sharingKey,
      searchQuery: saved.searchQuery,
      defaultDirectoryView: '/vacation/day1',
      password: null,
      creator,
      expires: Date.now() + 2000,
      timeStamp: Date.now()
    };
    const updated = await sm.updateSharing(update, false);

    expect(updated.searchQuery).to.deep.equals(sharing.searchQuery);
    expect(updated.defaultDirectoryView).to.equals('/vacation/day1');
    expect(updated.defaultSearchView == null).to.be.true;

    const found = await sm.findOne('testKeyUpdateDir');
    expect(found.searchQuery).to.deep.equals(sharing.searchQuery);
    expect(found.defaultDirectoryView).to.equals('/vacation/day1');
    expect(found.defaultSearchView == null).to.be.true;
  });

  it('should update sharing with defaultSearchView and not overwrite searchQuery', async () => {
    const sm = new SharingManager();

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKeyUpdateSearch',
      searchQuery: {value: '/vacation*', type: SearchQueryTypes.directory} as TextSearch,
      defaultDirectoryView: '/vacation',
      password: null,
      creator,
      expires: Date.now() + 1000,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);
    expect(saved.defaultDirectoryView).to.equals('/vacation');

    const update: UpdateSharingDTO = {
      id: saved.id,
      sharingKey: saved.sharingKey,
      searchQuery: saved.searchQuery,
      defaultSearchView: {value: 'beach', type: SearchQueryTypes.keyword} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 2000,
      timeStamp: Date.now()
    };
    const updated = await sm.updateSharing(update, false);

    expect(updated.searchQuery).to.deep.equals(sharing.searchQuery);
    expect(updated.defaultSearchView).to.deep.equals(update.defaultSearchView);
    expect(updated.defaultDirectoryView == null).to.be.true;

    const found = await sm.findOne('testKeyUpdateSearch');
    expect(found.searchQuery).to.deep.equals(sharing.searchQuery);
    expect(found.defaultSearchView).to.deep.equals(update.defaultSearchView);
    expect(found.defaultDirectoryView == null).to.be.true;
  });

  it('should fail to update sharing if both defaultDirectoryView and defaultSearchView are set', async () => {
    const sm = new SharingManager();

    const sharing: UpdateSharingDTO = {
      id: null,
      sharingKey: 'testKeyUpdateBoth',
      searchQuery: {value: '/vacation*', type: SearchQueryTypes.directory} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 1000,
      timeStamp: Date.now()
    };

    const saved = await sm.createSharing(sharing);

    const update: UpdateSharingDTO = {
      id: saved.id,
      sharingKey: saved.sharingKey,
      searchQuery: saved.searchQuery,
      defaultDirectoryView: '/vacation/day1',
      defaultSearchView: {value: 'beach', type: SearchQueryTypes.keyword} as TextSearch,
      password: null,
      creator,
      expires: Date.now() + 2000,
      timeStamp: Date.now()
    };

    try {
      await sm.updateSharing(update, false);
      expect.fail('should have thrown error');
    } catch (err) {
      expect(err.message).to.contain('cannot be set at the same time');
    }
  });


  describe('directory query', () => {
    const dq = (value: string): DirectorySearch =>
      ({type: SearchQueryTypes.directory, value, matchType: TextSearchQueryMatchTypes.globMatch});

    const newSharing = (s: Partial<UpdateSharingDTO>): UpdateSharingDTO => ({
      id: null,
      sharingKey: 'key_' + Math.random().toString(36).substring(7),
      searchQuery: null,
      password: null,
      creator,
      expires: Date.now() + 100000,
      timeStamp: Date.now(),
      ...s
    } as UpdateSharingDTO);

    it('should create sharing with only directory query', async () => {
      const sm = new SharingManager();
      const saved = await sm.createSharing(newSharing({directoryQuery: dq('/photos/*')}));
      const found = await sm.findOne(saved.sharingKey);
      expect(found.searchQuery).to.be.null;
      expect(found.directoryQuery).to.deep.equal(dq('/photos/*'));
    });

    it('should not create sharing without search and directory query', async () => {
      const sm = new SharingManager();
      let err: Error = null;
      try {
        await sm.createSharing(newSharing({}));
      } catch (e) {
        err = e;
      }
      expect(err).to.not.be.null;
    });

    it('should not create sharing with non directory directory query', async () => {
      const sm = new SharingManager();
      let err: Error = null;
      try {
        await sm.createSharing(newSharing({directoryQuery: {type: SearchQueryTypes.keyword, value: 'x'} as unknown as DirectorySearch}));
      } catch (e) {
        err = e;
      }
      expect(err).to.not.be.null;
    });

    it('should update directory query and keep the sharing valid', async () => {
      const sm = new SharingManager();
      const saved = await sm.createSharing(newSharing({directoryQuery: dq('/photos/*')}));
      const updated = await sm.updateSharing({...saved, directoryQuery: dq('/other/*')} as UpdateSharingDTO, true);
      expect(updated.directoryQuery).to.deep.equal(dq('/other/*'));

      let err: Error = null;
      try {
        await sm.updateSharing({...saved, searchQuery: null, directoryQuery: null} as UpdateSharingDTO, true);
      } catch (e) {
        err = e;
      }
      expect(err).to.not.be.null;
    });

    it('should list sharings by directory query and creator', async () => {
      const sm = new SharingManager();
      const byDir = await sm.createSharing(newSharing({directoryQuery: dq('/photos/*')}));
      await sm.createSharing(newSharing({directoryQuery: dq('/other/*')}));
      const bySearch = await sm.createSharing(newSharing({searchQuery: dq('/photos/*')}));

      const found = await sm.listAllForQuery(dq('/photos/*'));
      expect(found.map(s => s.sharingKey).sort()).to.deep.equal([byDir.sharingKey, bySearch.sharingKey].sort());

      // the creator filter does not replace the query filter
      const foundForCreator = await sm.listAllForQuery(dq('/photos/*'), creator);
      expect(foundForCreator.map(s => s.sharingKey).sort()).to.deep.equal([byDir.sharingKey, bySearch.sharingKey].sort());
      expect(await sm.listAllForQuery(dq('/photos/*'), {id: creator.id + 1000} as UserDTO)).to.deep.equal([]);
    });
  });
});
