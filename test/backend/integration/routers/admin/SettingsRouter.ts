import * as path from 'path';
import * as fs from 'fs';
import {Config} from '../../../../../src/common/config/private/Config';
import {Server} from '../../../../../src/backend/server';
import {DatabaseType, ServerConfig} from '../../../../../src/common/config/private/PrivateConfig';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import {TAGS} from '../../../../../src/common/config/public/ClientConfig';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {UserRoles} from '../../../../../src/common/entities/UserDTO';
import {ExtensionConfigWrapper} from '../../../../../src/backend/model/extension/ExtensionConfigWrapper';

process.env.NODE_ENV = 'test';
const chai: any = require('chai');
const chaiHttp = require('chai-http');
const should = chai.should();
chai.use(chaiHttp);

describe('SettingsRouter', () => {

  const tempDir = path.join(__dirname, '../../tmp');
  beforeEach(async () => {
    await fs.promises.rm(tempDir, {recursive: true, force: true});
    Config.Database.type = DatabaseType.sqlite;
    Config.Database.dbFolder = tempDir;
    ProjectPath.reset();
  });


  afterEach(async () => {
    await ObjectManagers.reset();
    await fs.promises.rm(tempDir, {recursive: true, force: true});
  });

  describe('/GET settings', () => {
    it('it should GET the settings', async () => {
      Config.Users.authenticationRequired = false;
      Config.Users.unAuthenticatedUserRole = UserRoles.Admin;
      const originalSettings = await ExtensionConfigWrapper.original();
      const srv = new Server();
      await srv.onStarted.wait();
      const result = await chai.request(srv.Server)
        .get(Config.Server.apiPath + '/settings');

      result.res.should.have.status(200);
      result.body.should.be.a('object');
      should.equal(result.body.error, null);
      (result.body.result as ServerConfig).Environment.upTime = null;
      originalSettings.Environment.upTime = null;
      result.body.result.should.deep.equal(JSON.parse(JSON.stringify(originalSettings.toJSON({
        attachState: true,
        attachVolatile: true,
        skipTags: {secret: true} as TAGS
      }))));
    });
  });
});
