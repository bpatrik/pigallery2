import {expect} from 'chai';
import * as path from 'node:path';
import {ErrorCodes, ErrorDTO} from '../../../../../src/common/entities/Error';
import {SettingsMWs} from '../../../../../src/backend/middlewares/admin/SettingsMWs';
import {ServerUserConfig} from '../../../../../src/common/config/private/PrivateConfig';
import {Config} from '../../../../../src/common/config/private/Config';
import {UserRoles} from '../../../../../src/common/entities/UserDTO';
import {ExtensionConfigWrapper} from '../../../../../src/backend/model/extension/ExtensionConfigWrapper';
import {ConfigClassBuilder} from 'typeconfig/node';
import {DBTestHelper} from '../../../DBTestHelper';
import {TestHelper} from '../../../../TestHelper';


declare let describe: any;
declare const it: any;
declare const after: any;
declare const beforeEach: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Settings middleware', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
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
    SettingsMWs.updateSettings(req, null!, next);


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

    const next2: any = () => {
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
    SettingsMWs.updateSettings(req, null!, next2);

  });

  // typeconfig validates the values and ConfigDiagnostics.testConfig checks them (both have their own tests);
  // this only checks that the middleware applies and saves nothing when they reject the settings
  it('should not change or save the config when the settings are rejected', async () => {
    const before = Config.Media.folder;
    const media = ConfigClassBuilder.attachPrivateInterface(Config.Media).toJSON({skipTags: {secret: true}}) as Record<string, unknown>;
    const req: any = {
      session: {}, sessionOptions: {}, query: {}, params: {},
      body: {settingsPath: 'Media', settings: {...media, folder: path.join(TestHelper.TMP_DIR, 'not-existing-images-folder')}}
    };
    const err = await new Promise<ErrorDTO | undefined>((resolve) => {
      SettingsMWs.updateSettings(req, null!, resolve as any).catch(resolve);
    });
    expect(err).to.be.instanceOf(ErrorDTO);
    expect(err!.code).to.equal(ErrorCodes.SETTINGS_ERROR);
    expect(Config.Media.folder).to.equal(before);
    expect((await ExtensionConfigWrapper.original()).Media.folder).to.equal(before);
  });

});
