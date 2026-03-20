import {expect} from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import {UploadManager} from '../../../../src/backend/model/UploadManager';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {Config} from '../../../../src/common/config/private/Config';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';

declare const describe: any;
declare const before: any;
declare const after: any;
declare const it: any;

describe('UploadManager', () => {
  const uploadManager = new UploadManager();
  const testDir = path.join(__dirname, 'tmp');

  before(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, {recursive: true});
    }
    Config.Media.folder = testDir;
    Config.Upload.enabled = true;
    ProjectPath.reset();

    // Mock ObjectManagers
    const om: any = ObjectManagers.getInstance();
    om.VersionManager = {onNewDataVersion: () => Promise.resolve()};
    om.initDone = true;
  });

  after(async () => {
    await ObjectManagers.reset();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true, force: true});
    }
  });

  it('should save a supported file', async () => {
    const file: any = {
      originalname: 'test.jpg',
      buffer: Buffer.from('test image content')
    };
    await uploadManager.saveFile('test_subdir', file);

    const savedPath = path.join(testDir, 'test_subdir', 'test.jpg');
    expect(fs.existsSync(savedPath)).to.be.true;
    expect(fs.readFileSync(savedPath).toString()).to.equal('test image content');
  });

  it('should throw error for unsupported file', async () => {
    const file: any = {
      originalname: 'test.exe',
      buffer: Buffer.from('test content')
    };
    try {
      await uploadManager.saveFile('', file);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e.message).to.contain('Unsupported file format');
    }
  });

  it('should handle multiple files with some errors', async () => {
    const files: any[] = [
      {
        originalname: 'valid.jpg',
        buffer: Buffer.from('valid jpg')
      },
      {
        originalname: 'invalid.exe',
        buffer: Buffer.from('invalid exe')
      }
    ];

    const errors = await uploadManager.saveFiles('multi_test', files);
    expect(errors.length).to.equal(1);
    expect(errors[0].filename).to.equal('invalid.exe');
    expect(errors[0].error).to.contain('Unsupported file format');

    const validPath = path.join(testDir, 'multi_test', 'valid.jpg');
    expect(fs.existsSync(validPath)).to.be.true;
  });

  it('should throw error if upload is disabled', async () => {
    Config.Upload.enabled = false;
    try {
      const file: any = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test content')
      };
      await uploadManager.saveFiles('', [file]);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal('Upload is disabled');
    } finally {
      Config.Upload.enabled = true;
    }
  });

  it('should throw error if enforcedDirectoryConfig is true and .uploader.pg2conf is missing', async () => {
    Config.Upload.enforcedDirectoryConfig = true;
    try {
      const file: any = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test content')
      };
      await uploadManager.saveFiles('no_config_dir', [file]);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal('Upload is not enabled in this directory');
    } finally {
      Config.Upload.enforcedDirectoryConfig = false;
    }
  });

  it('should save file if enforcedDirectoryConfig is true and .uploader.pg2conf exists', async () => {
    Config.Upload.enforcedDirectoryConfig = true;
    const dir = 'config_dir';
    const fullDirPath = path.join(testDir, dir);
    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, {recursive: true});
    }
    fs.writeFileSync(path.join(fullDirPath, '.uploader.pg2conf'), '');

    try {
      const file: any = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test content')
      };
      await uploadManager.saveFiles(dir, [file]);
      const savedPath = path.join(fullDirPath, 'test.jpg');
      expect(fs.existsSync(savedPath)).to.be.true;
    } finally {
      Config.Upload.enforcedDirectoryConfig = false;
    }
  });

  it('should return error if file already exists', async () => {
    const file: any = {
      originalname: 'exists.jpg',
      buffer: Buffer.from('content')
    };
    await uploadManager.saveFile('exists_test', file);

    const errors = await uploadManager.saveFiles('exists_test', [file]);
    expect(errors.length).to.equal(1);
    expect(errors[0].filename).to.equal('exists.jpg');
    expect(errors[0].error).to.contain('already exists');
  });
});
