import {expect} from 'chai';
import {ConfigClassBuilder} from 'typeconfig/node';
import {ExtensionConfigWrapper} from '../../../../src/backend/model/extension/ExtensionConfigWrapper';
import {TestHelper} from '../../../TestHelper';
import * as fs from 'fs';


describe('Config', () => {
  beforeEach(async () => {
    await fs.promises.rm(TestHelper.TMP_DIR, {recursive: true, force: true});
  });
  afterEach(async () => {
    await fs.promises.rm(TestHelper.TMP_DIR, {recursive: true, force: true});
  });
  it('should load default from env', () => {
    process.env['default-Media-tempFolder'] = 'test/test';
    const conf = ExtensionConfigWrapper.originalSync();
    expect(conf.Media.tempFolder).to.be.equal('test/test');
    expect(ConfigClassBuilder.attachPrivateInterface(conf.Media).__defaults.tempFolder).to.be.equal('test/test');
    expect(process.env['default-Media-tempFolder']).to.be.equal('test/test');
    const conf2 = ExtensionConfigWrapper.originalSync();
    expect(ConfigClassBuilder.attachPrivateInterface(conf2.Media).__defaults.tempFolder).to.be.equal('test/test');
    expect(conf2.Media.tempFolder).to.be.equal('test/test');
  });
});
