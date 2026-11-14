import {expect} from 'chai';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {UploadManager} from '../../../../src/backend/model/UploadManager';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {Config} from '../../../../src/common/config/private/Config';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {TestHelper} from '../../../TestHelper';

declare const describe: any;
declare const before: any;
declare const after: any;
declare const it: any;

describe('UploadManager', () => {
  before(TestHelper.resetConfig);
  const uploadManager = new UploadManager();
  const testDir = path.join(__dirname, 'tmp');
  // multer saves the uploaded files to the temp folder first
  const tempDir = path.join(__dirname, 'tmp_upload_temp');
  let tempFiles = 0;
  const uploaded = (originalname: string, content: string): Express.Multer.File => {
    fs.mkdirSync(tempDir, {recursive: true});
    const tempPath = path.join(tempDir, String(tempFiles++));
    fs.writeFileSync(tempPath, content);
    return {originalname, path: tempPath} as Express.Multer.File;
  };

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
    fs.rmSync(testDir, {recursive: true, force: true});
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  it('should save a supported file', async () => {
    const file: any = uploaded('test.jpg', 'test image content');
    await uploadManager.saveFile('test_subdir', file);

    const savedPath = path.join(testDir, 'test_subdir', 'test.jpg');
    expect(fs.existsSync(savedPath)).to.be.true;
    expect(fs.readFileSync(savedPath).toString()).to.equal('test image content');
  });

  it('should move the uploaded file out of the temp folder', async () => {
    const file = uploaded('moved.jpg', 'test image content');
    await uploadManager.saveFile('', file);

    expect(fs.readFileSync(path.join(testDir, 'moved.jpg')).toString()).to.equal('test image content');
    expect(fs.existsSync(file.path)).to.be.false;
  });

  it('should reject a file above the size limit with the limit in the message', async () => {
    const file = {...uploaded('too_large.jpg', 'content'), tooLarge: true};
    try {
      await uploadManager.saveFile('', file);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect((e as Error).message).to.contain(Config.Upload.maxFileSizeMB + ' MB');
    }
    expect(fs.existsSync(path.join(testDir, 'too_large.jpg'))).to.be.false;
  });

  it('should throw error for unsupported file', async () => {
    const file: any = uploaded('test.exe', 'test content');
    try {
      await uploadManager.saveFile('', file);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect((e as Error).message).to.contain('Unsupported file format');
    }
  });

  it('should reject filenames with path components', async () => {
    for (const name of ['../escape.jpg', '..\\escape.jpg', 'sub/escape.jpg', '../../../../../tmp/poc.gpx', '..', '.', '']) {
      const file: any = uploaded(name, 'test content');
      try {
        await uploadManager.saveFile('traversal_test', file);
        expect.fail('Should have thrown an error for: ' + name);
      } catch (e) {
        expect((e as Error).message, name).to.contain('Invalid filename');
      }
    }
    expect(fs.existsSync(path.join(testDir, 'escape.jpg'))).to.be.false;
    expect(fs.existsSync(path.join(testDir, 'traversal_test', 'sub'))).to.be.false;
  });

  it('should reject a directory outside of the image folder', async () => {
    const file: any = uploaded('outside.jpg', 'test content');
    try {
      await uploadManager.saveFile('../outside_dir', file);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect((e as Error).message).to.contain('Invalid upload path');
    }
    expect(fs.existsSync(path.join(testDir, '..', 'outside_dir'))).to.be.false;
  });

  it('should reject a directory outside of the image folder when checking the directory config', async () => {
    Config.Upload.enforcedDirectoryConfig = true;
    // a directory config outside the image folder must not enable the upload
    const outsideDir = path.join(testDir, '..', 'outside_conf_dir');
    fs.mkdirSync(outsideDir, {recursive: true});
    fs.writeFileSync(path.join(outsideDir, '.uploader.pg2conf'), '');
    try {
      const file: any = uploaded('outside.jpg', 'test content');
      await uploadManager.saveFiles('../outside_conf_dir', [file]);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect((e as Error).message).to.contain('Invalid upload path');
    } finally {
      Config.Upload.enforcedDirectoryConfig = false;
      fs.rmSync(outsideDir, {recursive: true, force: true});
    }
  });

  it('should not accept blocked extensions by default', async () => {
    for (const name of ['.uploader.pg2conf', 'sorting.PG2CONF', 'image.svg']) {
      const file: any = uploaded(name, '{}');
      try {
        await uploadManager.saveFile('blocked_test', file);
        expect.fail('Should have thrown an error for: ' + name);
      } catch (e) {
        expect((e as Error).message, name).to.contain('Unsupported file format');
      }
    }
  });

  it('should accept supported extensions that are removed from blockedExtensions', async () => {
    const blocked = Config.Upload.blockedExtensions;
    Config.Upload.blockedExtensions = [];
    try {
      for (const name of ['.uploader.pg2conf', 'image.svg']) {
        const file: any = uploaded(name, '{}');
        await uploadManager.saveFile('unblocked_test', file);
        expect(fs.existsSync(path.join(testDir, 'unblocked_test', name)), name).to.be.true;
      }
    } finally {
      Config.Upload.blockedExtensions = blocked;
    }
  });

  it('should block any listed extension', async () => {
    const blocked = Config.Upload.blockedExtensions;
    Config.Upload.blockedExtensions = ['JPG'];
    try {
      const file: any = uploaded('image.jpg', 'test');
      await uploadManager.saveFile('blocked_jpg_test', file);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect((e as Error).message).to.contain('Unsupported file format');
    } finally {
      Config.Upload.blockedExtensions = blocked;
    }
  });

  it('should handle multiple files with some errors', async () => {
    const files: any[] = [
      uploaded('valid.jpg', 'valid jpg'),
      uploaded('invalid.exe', 'invalid exe')
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
      const file: any = uploaded('test.jpg', 'test content');
      await uploadManager.saveFiles('', [file]);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect((e as Error).message).to.equal('Upload is disabled');
    } finally {
      Config.Upload.enabled = true;
    }
  });

  it('should throw error if enforcedDirectoryConfig is true and .uploader.pg2conf is missing', async () => {
    Config.Upload.enforcedDirectoryConfig = true;
    try {
      const file: any = uploaded('test.jpg', 'test content');
      await uploadManager.saveFiles('no_config_dir', [file]);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect((e as Error).message).to.equal('Upload is not enabled in this directory');
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
      const file: any = uploaded('test.jpg', 'test content');
      await uploadManager.saveFiles(dir, [file]);
      const savedPath = path.join(fullDirPath, 'test.jpg');
      expect(fs.existsSync(savedPath)).to.be.true;
    } finally {
      Config.Upload.enforcedDirectoryConfig = false;
    }
  });

  it('should return error if file already exists', async () => {
    const file: any = uploaded('exists.jpg', 'content');
    await uploadManager.saveFile('exists_test', file);

    const errors = await uploadManager.saveFiles('exists_test', [file]);
    expect(errors.length).to.equal(1);
    expect(errors[0].filename).to.equal('exists.jpg');
    expect(errors[0].error).to.contain('already exists');
  });
});
