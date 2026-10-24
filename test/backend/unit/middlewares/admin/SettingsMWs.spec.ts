/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import {expect} from 'chai';
import {ErrorDTO} from '../../../../../src/common/entities/Error';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {SettingsMWs} from '../../../../../src/backend/middlewares/admin/SettingsMWs';
import {ServerUserConfig} from '../../../../../src/common/config/private/PrivateConfig';
import {Config} from '../../../../../src/common/config/private/Config';
import {UserRoles} from '../../../../../src/common/entities/UserDTO';
import {ExtensionConfigWrapper} from '../../../../../src/backend/model/extension/ExtensionConfigWrapper';
import {ConfigClassBuilder} from 'typeconfig/node';
import {DBTestHelper} from '../../../DBTestHelper';


declare let describe: any;
declare const it: any;
declare const after: any;
declare const beforeEach: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Settings middleware', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;

  beforeEach(sqlHelper.initDB);
  after(sqlHelper.clearDB);

  it('should save empty enforced users settings', (done: (err?: any) => void) => {
    const req: any = {
      session: {},
      sessionOptions: {},
      query: {},
      params: {},
      body: {
        settingsPath: 'Users',
        settings: ConfigClassBuilder.attachPrivateInterface(new ServerUserConfig()).toJSON()
      }
    };
    req.body.settings.enforcedUsers = [];
    const next: any = (err: ErrorDTO) => {
      try {
        expect(err).to.be.undefined;
        expect(Config.Users.enforcedUsers.length).to.be.equal(0);
        done();
      } catch (err) {
        console.error(err);
        done(err);
      }
    };
    SettingsMWs.updateSettings(req, null, next);


  });
  it('should save enforced users settings', (done: (err?: any) => void) => {

    const req: any = {
      session: {},
      sessionOptions: {},
      query: {},
      params: {},
      body: {
        settingsPath: 'Users',
        settings: {
          enforcedUsers: [],
          authenticationRequired: false,
          unAuthenticatedUserRole: UserRoles.User
        }
      }
    };

    req.body.settings.enforcedUsers = [{name: 'Apple', password: 'Apple pass', role: UserRoles.User}];

    const next2: any = (err: ErrorDTO) => {
      try {
        expect(Config.Users.enforcedUsers.length).to.be.equal(1);
        expect(Config.Users.enforcedUsers[0].name).to.be.equal('Apple');
        expect(Config.Users.enforcedUsers.length).to.be.equal(1);
        ExtensionConfigWrapper.original().then((cfg) => {
          try {
            expect(cfg.Users.enforcedUsers.length).to.be.equal(1);
            expect(cfg.Users.enforcedUsers[0].name).to.be.equal('Apple');
            done();
          } catch (err) {
            console.error(err);
            done(err);
          }
        }).catch(done);
      } catch (err) {
        console.error(err);
        done(err);
      }
    };
    SettingsMWs.updateSettings(req, null, next2);

  });


});
