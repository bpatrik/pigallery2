/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import * as chai from 'chai';
import {expect} from 'chai';
import {UserDTO, UserRoles} from '../../../../../src/common/entities/UserDTO';
import {DBTestHelper} from '../../../DBTestHelper';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Utils} from '../../../../../src/common/Utils';
import {UserManager} from '../../../../../src/backend/model/database/UserManager';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

declare let describe: any;
declare const it: any;
declare const beforeEach: any;
declare const after: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe(); // fake it so the IDE plays nicely (recognize the test)

describe('UserManager', (sqlHelper: DBTestHelper) => {
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
  });
});

