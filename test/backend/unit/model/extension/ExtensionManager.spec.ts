import {expect} from 'chai';
import express from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import {AddressInfo} from 'node:net';
import {ServerExtensionsEntryConfig} from '../../../../../src/common/config/private/subconfigs/ServerExtensionsConfig';
import {ExtensionManager} from '../../../../../src/backend/model/extension/ExtensionManager';
import {ExtensionEvent} from '../../../../../src/backend/model/extension/ExtensionEvent';
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
        err = e as Error;
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

  describe('reload', () => {
    const tmpDir = path.join(__dirname, 'tmp_ext_reload');
    const extFolder = path.join(tmpDir, 'extensions');
    const folder = 'reload-test';
    let origExtFolder: string;
    let server: http.Server;
    let baseUrl: string;
    let em: ExtensionManager;
    const log = (): string[] => (global as any).__extReloadLog;

    // the extension answers with its version on a route and logs its init and cleanUp calls
    const writeExtension = (version: string): void => {
      fs.writeFileSync(path.join(extFolder, folder, 'server.js'), `
const version = '${version}';
module.exports.init = async (ext) => {
  global.__extReloadLog.push('init ' + version);
  ext.RESTApi.get.rawMiddleware(['ping'], 0, (req, res) => res.send(version));
  ext.events.gallery.DiskManager.excludeDir.before(async (input) => {
    global.__extReloadLog.push('event ' + version);
    return input;
  });
};
module.exports.cleanUp = async () => {
  global.__extReloadLog.push('cleanUp ' + version);
};
`);
    };

    const ping = async (): Promise<string> => {
      const res = await fetch(baseUrl + '/' + folder + '/ping');
      return res.status + ' ' + await res.text();
    };

    beforeEach(async () => {
      origExtFolder = ProjectPath.ExtensionFolder;
      fs.mkdirSync(path.join(extFolder, folder), {recursive: true});
      ProjectPath.ExtensionFolder = extFolder;
      Config.Extensions.enabled = true;
      Config.Extensions.extensions.addProperty(folder, {type: ServerExtensionsEntryConfig}, new ServerExtensionsEntryConfig(folder));
      (global as any).__extReloadLog = [];
      writeExtension('v1');

      em = new ExtensionManager();
      const app = express();
      app.use((req, res, next) => em.handleRequest(req, res, next));
      app.use((req, res) => res.status(404).send('not found'));
      server = app.listen(0);
      await new Promise<void>((resolve) => server.once('listening', () => resolve()));
      baseUrl = 'http://localhost:' + (server.address() as AddressInfo).port;
      await (em as any).initExtensions();
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      ProjectPath.ExtensionFolder = origExtFolder;
      fs.rmSync(tmpDir, {recursive: true, force: true});
      delete (global as any).__extReloadLog;
    });

    after(TestHelper.resetConfig);

    it('should run the changed code of the extension', async () => {
      expect(await ping()).to.equal('200 v1');
      writeExtension('v2');

      await em.reloadExtension(folder);

      expect(log()).to.deep.equal(['init v1', 'cleanUp v1', 'init v2']);
      expect(await ping()).to.equal('200 v2');
    });

    it('should remove the routes of the extension on clean up', async () => {
      expect(await ping()).to.equal('200 v1');
      await em.cleanUp();
      expect(await ping()).to.equal('404 not found');
    });

    it('should remove the event handlers of the extension on reload', async () => {
      writeExtension('v2');
      await em.reloadExtension(folder);
      (global as any).__extReloadLog = [];

      await (em.events.gallery.DiskManager.excludeDir as ExtensionEvent<[{name: string, parentDirRelativeName: string, parentDirAbsoluteName: string}], boolean>)
        .triggerBefore([{name: 'a', parentDirRelativeName: '', parentDirAbsoluteName: ''}], {stopPropagation: false});

      expect(log()).to.deep.equal(['event v2']);
    });

    it('should init an extension that had no extension object yet', async () => {
      await em.cleanUp();
      writeExtension('v2');

      await em.reloadExtension(folder);

      expect(await ping()).to.equal('200 v2');
    });
  });
});
