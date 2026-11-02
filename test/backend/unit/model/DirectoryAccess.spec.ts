/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import {expect} from 'chai';
import * as path from 'path';
import {DBTestHelper} from '../../DBTestHelper';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {DirectoryAccess, DirectoryAccessTypes} from '../../../../src/backend/model/DirectoryAccess';
import {SessionUser, SessionContext} from '../../../../src/backend/model/SessionContext';
import {DirectorySearch, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';
import {UserRoles} from '../../../../src/common/entities/UserDTO';
import {SharingEntity} from '../../../../src/backend/model/database/enitites/SharingEntity';
import {UserEntity} from '../../../../src/backend/model/database/enitites/UserEntity';
import {TestHelper} from '../../../TestHelper';

declare let describe: any;
declare const before: any;
declare const after: any;
declare const it: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('DirectoryAccess', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  const {none, parent, available} = DirectoryAccessTypes;

  const dq = (value: string, matchType = TextSearchQueryMatchTypes.exact_match, negate = false): DirectorySearch =>
    ({type: SearchQueryTypes.directory, value, matchType, negate});
  const glob = (value: string): DirectorySearch => dq(value, TextSearchQueryMatchTypes.globMatch);
  const fileName = (value: string): TextSearch =>
    ({type: SearchQueryTypes.file_name, value, matchType: TextSearchQueryMatchTypes.like});

  const userSession = (u: Partial<SessionUser>): Promise<SessionContext> =>
    ObjectManagers.getInstance().SessionManager.buildContext({
      id: 1,
      name: 'user',
      role: UserRoles.User,
      overrideAllowBlockList: true,
      ...u
    } as SessionUser);

  const sharingSession = (s: Partial<SharingEntity>, creator: Partial<UserEntity> = {}): Promise<SessionContext> => {
    const sm = ObjectManagers.getInstance().SessionManager;
    return sm.buildContext(sm.createSharingUser({
      sharingKey: 'key',
      creator: {id: 1, name: 'creator', role: UserRoles.Admin, overrideAllowBlockList: true, ...creator},
      ...s
    } as SharingEntity));
  };

  const accessOf = async (session: SessionContext, dirs: string[]) => {
    const ret: { [key: string]: DirectoryAccessTypes } = {};
    for (const d of dirs) {
      ret[d] = await session.directoryAccess.getAccess(path.normalize(d));
    }
    return ret;
  };

  /**
   * ./ (rootPhoto)
   *  public/ (publicPhoto)
   *    sub/ (subPhoto)
   *  private/ (privatePhoto)
   *    deep/ (deepPhoto)
   *  other/ (otherPhoto)
   */
  before(async () => {
    await sqlHelper.initDB();
    await sqlHelper.setUpNestedTestGallery();
  });

  after(sqlHelper.clearDB);

  describe('session context', () => {
    it('a new session context has no directory restriction', async () => {
      const s = new SessionContext();
      s.user = {} as SessionUser;
      expect(s.directoryAccess).to.be.instanceOf(DirectoryAccess);
      expect(await accessOf(s, ['/', 'public/sub'])).to.deep.equal({'/': available, 'public/sub': available});
    });

    it('can be serialized with its session context (no circular reference)', async () => {
      const s = await userSession({blockDirectoryList: [dq('private')]});
      const json = JSON.parse(JSON.stringify(s));
      expect(json.directoryAccess.blockList).to.deep.equal([dq('private')]);
      expect(json.directoryAccess.context).to.be.undefined;
    });
  });

  describe('users', () => {
    it('everything is available without lists', async () => {
      const s = await userSession({});
      expect(await accessOf(s, ['/', 'public/sub', 'not_existing'])).to.deep.equal({
        '/': available, 'public/sub': available, 'not_existing': available
      });
    });

    it('blocked directories are not available', async () => {
      const s = await userSession({blockDirectoryList: [dq('private')]});
      expect(await accessOf(s, ['private', 'private/deep', 'public'])).to.deep.equal({
        'private': none, 'private/deep': available, 'public': available
      });
    });

    it('trailing /* blocks the directory and everything below', async () => {
      const s = await userSession({blockDirectoryList: [glob('private/*')]});
      expect(await accessOf(s, ['private', 'private/deep', 'private/not_existing', 'privateer'])).to.deep.equal({
        'private': none, 'private/deep': none, 'private/not_existing': none, 'privateer': available
      });
    });

    it('/?* blocks only below the directory', async () => {
      const s = await userSession({blockDirectoryList: [glob('private/?*')]});
      expect(await accessOf(s, ['private', 'private/deep'])).to.deep.equal({
        'private': available, 'private/deep': none
      });
    });

    it('parents of allowed directories can be opened', async () => {
      const s = await userSession({allowDirectoryList: [glob('public/sub/*')]});
      expect(await accessOf(s, ['/', 'public', 'public/sub', 'public/sub/new', 'other', 'publicity', 'not_existing']))
        .to.deep.equal({
        '/': parent, 'public': parent, 'public/sub': available, 'public/sub/new': available,
        'other': none, 'publicity': none, 'not_existing': none
      });
    });

    it('parents of exact allowed directories can be opened', async () => {
      const s = await userSession({allowDirectoryList: [dq('public/sub')]});
      expect(await accessOf(s, ['/', 'public', 'public/sub', 'public/sub/deeper'])).to.deep.equal({
        '/': parent, 'public': parent, 'public/sub': available, 'public/sub/deeper': none
      });
    });

    it('parents of like searches are found in the DB', async () => {
      const s = await userSession({allowDirectoryList: [dq('sub', TextSearchQueryMatchTypes.like)]});
      expect(await accessOf(s, ['/', 'public', 'public/sub', 'other', 'private', 'not_existing'])).to.deep.equal({
        '/': parent, 'public': parent, 'public/sub': available, 'other': none, 'private': none, 'not_existing': none
      });
    });

    it('blocked directory is not a parent', async () => {
      const s = await userSession({allowDirectoryList: [dq('public/sub')], blockDirectoryList: [dq('public')]});
      expect(await accessOf(s, ['/', 'public', 'public/sub'])).to.deep.equal({
        '/': parent, 'public': none, 'public/sub': available
      });
    });

  });

  describe('sharing with directory query', () => {
    it('only the shared directories are available, no parents', async () => {
      const s = await sharingSession({directoryQuery: glob('public/*')});
      expect(await accessOf(s, ['/', 'public', 'public/sub', 'public/new_folder', 'other', 'publicity'])).to.deep.equal({
        '/': none, 'public': available, 'public/sub': available, 'public/new_folder': available, 'other': none, 'publicity': none
      });
    });

    it('exact directory sharing does not include subdirectories', async () => {
      const s = await sharingSession({directoryQuery: dq('public')});
      expect(await accessOf(s, ['public', 'public/sub'])).to.deep.equal({'public': available, 'public/sub': none});
    });

    it('inherits the lists of the creator', async () => {
      const s = await sharingSession({directoryQuery: glob('public/*')}, {blockDirectoryList: [dq('public/sub')]});
      expect(await accessOf(s, ['public', 'public/sub'])).to.deep.equal({'public': available, 'public/sub': none});
    });
  });

  describe('sharing without directory query', () => {
    it('only directories with visible photos are available, their parents can be opened', async () => {
      const s = await sharingSession({searchQuery: fileName('subPhoto')});
      expect(await accessOf(s, ['/', 'public', 'public/sub', 'other', 'private', 'not_existing'])).to.deep.equal({
        '/': parent, 'public': parent, 'public/sub': available, 'other': none, 'private': none, 'not_existing': none
      });
    });

    it('inherits the lists of the creator', async () => {
      const s = await sharingSession({searchQuery: fileName('Photo')}, {blockDirectoryList: [dq('public/sub')]});
      expect(await accessOf(s, ['public', 'public/sub', 'other'])).to.deep.equal({
        'public': available, 'public/sub': none, 'other': available
      });
    });
  });

  describe('getAvailableParents', () => {
    it('all parents are available for users, except the blocked ones', async () => {
      const s = await userSession({allowDirectoryList: [glob('a/b/c/*')], blockDirectoryList: [dq('a/b')]});
      // parents of a/b/c/d: root, a, a/b, a/b/c
      expect(s.directoryAccess.getAvailableParents(path.normalize('a/b/c/d'))).to.deep.equal([true, true, false, true]);
      expect(s.directoryAccess.getAvailableParents('/')).to.deep.equal([]);
    });

    it('sharing users can only open the shared directories', async () => {
      const s = await sharingSession({directoryQuery: glob('public/*')});
      // parents of public/sub/x: root, public, public/sub
      expect(s.directoryAccess.getAvailableParents(path.normalize('public/sub/x'))).to.deep.equal([false, true, true]);
    });

    it('sharing without directory query can open the parents of directories with photos', async () => {
      const s = await sharingSession({searchQuery: fileName('subPhoto')}, {blockDirectoryList: [dq('public')]});
      // parents of public/sub: root, public
      expect(s.directoryAccess.getAvailableParents(path.normalize('public/sub'))).to.deep.equal([true, false]);
    });

    it('supports deep directories', async () => {
      const s = await userSession({});
      const deep = Array.from({length: 60}, (_, i) => 'd' + i).join('/');
      expect(s.directoryAccess.getAvailableParents(deep)).to.deep.equal(new Array(60).fill(true));
    });
  });

  describe('isListedInSearch', () => {
    it('lists directories with photos below for users, with own photos for search-only sharing', async () => {
      const user = await userSession({});
      const sharing = await sharingSession({searchQuery: fileName('Photo')});
      expect(user.directoryAccess.isListedInSearch({mediaCount: 0, recursiveMediaCount: 1})).to.be.true;
      expect(sharing.directoryAccess.isListedInSearch({mediaCount: 0, recursiveMediaCount: 1})).to.be.false;
      expect(sharing.directoryAccess.isListedInSearch({mediaCount: 1, recursiveMediaCount: 1})).to.be.true;
    });
  });
});
