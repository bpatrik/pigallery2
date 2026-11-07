import * as chai from 'chai';
import {expect} from 'chai';
import {UserDTO, UserRoles} from '../../../../../src/common/entities/UserDTO';
import {DBTestHelper} from '../../../DBTestHelper';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Utils} from '../../../../../src/common/Utils';
import {UserManager} from '../../../../../src/backend/model/database/UserManager';
import chaiAsPromised from 'chai-as-promised';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {UserEntity} from '../../../../../src/backend/model/database/enitites/UserEntity';
import {VersionEntity} from '../../../../../src/backend/model/database/enitites/VersionEntity';
import {TestHelper} from '../../../../TestHelper';

chai.use(chaiAsPromised);

declare let describe: any;
declare const it: any;
declare const beforeEach: any;
declare const after: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe(); // fake it so the IDE plays nicely (recognize the test)

describe('UserManager', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;
  describe('buildContext',async () => {

    const testUser: UserDTO = {
      id: 1,
      name: 'test',
      password: 'testp',
      role: UserRoles.User
    };
    // Reset ObjectManagers before each test
    beforeEach(async () => {
      await sqlHelper.initDB();
      await ObjectManagers.getInstance().UserManager.createUser(Utils.clone(testUser));
    });

    after(sqlHelper.clearDB);

    describe('findOne',async () => {
      it('should return when passwords and name is also set', async () => {
        // Create a basic user with no queries
        const um = new UserManager();

        const u = await um.findOne({name: 'test',password: 'testp'});
        expect(u).to.not.be.null;
        expect(u.name).to.eql('test');
      });
      it('should return when passwords is not set', async () => {
        // Create a basic user with no queries
        const um = new UserManager();

        const u = await um.findOne({name: 'test'});
        expect(u).to.not.be.null;
        expect(u.name).to.eql('test');
      });

      it('should return null when passwords is  empty string', async () => {
        // Create a basic user with no queries
        const um = new UserManager();

        await expect(um.findOne({name: 'test', password: ''})).to.be.rejectedWith(Error);
      });

    });

    // a lookup with a missing value must not match the first row (e.g.: the admin)
    describe('missing lookup values', async () => {
      beforeEach(async () => {
        await ObjectManagers.getInstance().UserManager.createUser({
          name: 'Árvíztűrő',
          password: 'pass',
          role: UserRoles.Admin
        } as UserDTO);
      });

      it('should reject findOne without a value', async () => {
        const um = new UserManager();
        await expect(um.findOne({name: undefined})).to.be.rejectedWith(Error);
        await expect(um.findOne({id: undefined})).to.be.rejectedWith(Error);
        await expect(um.findOne({oidcSubject: undefined})).to.be.rejectedWith(Error);
        await expect(um.findOne({name: undefined, password: 'testp'})).to.be.rejectedWith(Error);
        await expect(um.findOne({})).to.be.rejectedWith(Error);
      });

      it('should reject find with an undefined value', async () => {
        const um = new UserManager();
        await expect(um.find({name: undefined})).to.be.rejectedWith(Error);
        expect((await um.find({})).length).to.eql(2);
      });

      it('should reject changing a user without an id', async () => {
        const um = new UserManager();
        await expect(um.deleteUser(undefined)).to.be.rejectedWith(Error);
        await expect(um.deleteUser(NaN)).to.be.rejectedWith(Error);
        await expect(um.changeRole(undefined, UserRoles.Guest)).to.be.rejectedWith(Error);
        await expect(um.setOidcSubject(undefined, 'https://idp|123')).to.be.rejectedWith(Error);
        await expect(um.updateSettings(undefined, {newPassword: 'x'})).to.be.rejectedWith(Error);

        const users = (await um.find({})).sort((a, b) => a.id - b.id);
        expect(users.map(u => ({name: u.name, role: u.role, oidcSubject: u.oidcSubject}))).to.deep.equal([
          {name: 'test', role: UserRoles.User, oidcSubject: null},
          {name: 'Árvíztűrő', role: UserRoles.Admin, oidcSubject: null}
        ]);
        expect(await um.findOne({name: 'test', password: 'testp'})).to.not.be.null;
      });
    });

    describe('oidc', async () => {
      it('should set and unset the OIDC subject', async () => {
        const um = new UserManager();
        const u = await um.findOne({name: 'test'});

        await um.setOidcSubject(u.id, 'https://idp|123');
        expect((await um.findOne({oidcSubject: 'https://idp|123'})).id).to.eql(u.id);

        await um.setOidcSubject(u.id, null);
        expect(await um.findOne({oidcSubject: 'https://idp|123'})).to.be.null;
      });

      it('should keep users on scheme update if the old scheme misses a column', async () => {
        const connection = await SQLConnection.getConnection();
        const tableName = connection.getMetadata(UserEntity).tableName;
        await connection.query(`ALTER TABLE ${tableName} DROP COLUMN oidcSubject`);
        await connection.query(`UPDATE ${connection.getMetadata(VersionEntity).tableName} SET version = 0`);

        await (SQLConnection as any).schemeSync(connection);

        const u = await new UserManager().findOne({name: 'test', password: 'testp'});
        expect(u.role).to.eql(UserRoles.User);
        expect(u.oidcSubject).to.be.null;
      });
    });
  });
});

