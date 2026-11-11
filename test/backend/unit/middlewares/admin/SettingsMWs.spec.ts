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



  describe('invalid settings', () => {
    // resolves with the error SettingsMWs.updateSettings passed to next (undefined on success)
    const save = (settingsPath: string, settings: unknown): Promise<ErrorDTO | undefined> =>
      new Promise((resolve) => {
        const req: any = {session: {}, sessionOptions: {}, query: {}, params: {}, body: {settingsPath, settings}};
        SettingsMWs.updateSettings(req, null!, resolve as any).catch(resolve);
      });
    const sharingJSON = (): Record<string, unknown> =>
      ConfigClassBuilder.attachPrivateInterface(Config.Sharing).toJSON({skipTags: {secret: true}}) as Record<string, unknown>;

    it('should reject a number above its maximum and keep the config', async () => {
      const before = Config.Sharing.sharingKeyLength;
      const err = await save('Sharing', {...sharingJSON(), sharingKeyLength: 200});
      expect(err).to.be.instanceOf(ErrorDTO);
      expect(err!.code).to.equal(ErrorCodes.SETTINGS_ERROR);
      expect(Config.Sharing.sharingKeyLength).to.equal(before);
      expect((await ExtensionConfigWrapper.original()).Sharing.sharingKeyLength).to.equal(before);
    });

    it('should reject a negative number and keep the config', async () => {
      const before = Config.Sharing.sharingKeyLength;
      const err = await save('Sharing', {...sharingJSON(), sharingKeyLength: -5});
      expect(err).to.be.instanceOf(ErrorDTO);
      expect(Config.Sharing.sharingKeyLength).to.equal(before);
      expect((await ExtensionConfigWrapper.original()).Sharing.sharingKeyLength).to.equal(before);
    });

    it('should reject an images folder that does not exist and keep the config', async () => {
      const before = Config.Media.folder;
      const media = ConfigClassBuilder.attachPrivateInterface(Config.Media).toJSON({skipTags: {secret: true}}) as Record<string, unknown>;
      const err = await save('Media', {...media, folder: path.join(TestHelper.TMP_DIR, 'not-existing-images-folder')});
      expect(err).to.be.instanceOf(ErrorDTO);
      expect(err!.code).to.equal(ErrorCodes.SETTINGS_ERROR);
      expect(Config.Media.folder).to.equal(before);
      expect((await ExtensionConfigWrapper.original()).Media.folder).to.not.contain('not-existing-images-folder');
    });

    // decision of #1315: the whole save is rejected, also the valid changes of it
    it('should not keep the valid changes of a rejected save', async () => {
      const before = Config.Sharing.passwordRequired;
      const err = await save('Sharing', {...sharingJSON(), passwordRequired: !before, sharingKeyLength: 200});
      expect(err).to.be.instanceOf(ErrorDTO);
      expect(Config.Sharing.passwordRequired).to.equal(before);
      expect((await ExtensionConfigWrapper.original()).Sharing.passwordRequired).to.equal(before);
    });
  });

});
