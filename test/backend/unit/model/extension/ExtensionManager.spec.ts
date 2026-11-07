import {expect} from 'chai';
import * as express from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {ExtensionManager} from '../../../../../src/backend/model/extension/ExtensionManager';
import {IExtensionObject} from '../../../../../src/backend/model/extension/IExtension';
import {TestHelper} from '../../../../TestHelper';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import {Config} from '../../../../../src/common/config/private/Config';
import {ExtensionListItem} from '../../../../../src/common/entities/extension/ExtensionListItem';

// to help WebStorm to handle the test cases
declare let describe: any;
declare const before: any;
declare const after: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;


describe('ExtensionManager', () => {
  before(TestHelper.resetConfig);

  it('should give every extension with the same name its own object', () => {
    const em = new ExtensionManager();
    em.router = express.Router();
    const create = (folder: string): IExtensionObject<unknown> => (em as any).createUniqueExtensionObject('sample', folder);

    const ids = ['a', 'b', 'c', 'd'].map((folder) => create(folder).extensionId);

    expect(ids).to.deep.equal(['sample', 'sample_2', 'sample_3', 'sample_4']);
    expect(Object.values(em.extObjects).map((o) => o.folder)).to.deep.equal(['a', 'b', 'c', 'd']);
  });

  describe('request-provided extension names', () => {
    const tmpDir = path.join(__dirname, 'tmp_ext');
    const extFolder = path.join(tmpDir, 'extensions');
    const victim = path.join(tmpDir, 'victim');
    let origExtFolder: string;

    beforeEach(() => {
      origExtFolder = ProjectPath.ExtensionFolder;
      fs.mkdirSync(extFolder, {recursive: true});
      fs.mkdirSync(victim, {recursive: true});
      ProjectPath.ExtensionFolder = extFolder;
      Config.Extensions.enabled = true;
    });

    afterEach(() => {
      ProjectPath.ExtensionFolder = origExtFolder;
      fs.rmSync(tmpDir, {recursive: true, force: true});
    });

    after(TestHelper.resetConfig);

    const expectError = async (fn: () => Promise<void>, msg: string): Promise<void> => {
      let err: Error = null!;
      try {
        await fn();
      } catch (e) {
        err = e;
      }
      expect(err, msg).to.not.be.null;
      expect(err.message).to.contain(msg);
    };

    it('should not delete anything outside of the extension folder', async () => {
      const em = new ExtensionManager();
      for (const key of ['..', '../victim', path.join('..', 'victim'), '.', '']) {
        await expectError(() => em.deleteExtension(key), 'Invalid extension');
        expect(fs.existsSync(victim), key).to.be.true;
        expect(fs.existsSync(extFolder), key).to.be.true;
      }
    });

    it('should not install an extension into a folder outside of the extension folder', async () => {
      const em = new ExtensionManager();
      for (const id of ['../victim', '..', 'a/b', 'a\\b']) {
        em.repository.getExtensionList = async (): Promise<ExtensionListItem[]> =>
          [{id, name: id, zipUrl: 'http://localhost:1/ext.zip'} as ExtensionListItem];
        await expectError(() => em.installExtension(id), 'Invalid extension');
      }
      expect(fs.readdirSync(extFolder)).to.deep.equal([]);
      expect(fs.readdirSync(tmpDir).sort()).to.deep.equal(['extensions', 'victim']);
    });
  });
});
