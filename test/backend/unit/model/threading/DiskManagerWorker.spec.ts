import {expect} from 'chai';
import * as path from 'path';
import {Config} from '../../../../../src/common/config/private/Config';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import {Utils} from '../../../../../src/common/Utils';
import {DatabaseType} from '../../../../../src/common/config/private/PrivateConfig';
import {DiskManager} from '../../../../../src/backend/model/fileaccess/DiskManager';

declare const before: any;
declare const afterEach: any;

describe('DiskMangerWorker', () => {
  // loading default settings (this might have been changed by other tests)
  before(() => {
    Config.loadSync();
    Config.Database.type = DatabaseType.sqlite;
    Config.Faces.enabled = true;
    Config.Faces.keywordsToPersons = true;
    Config.Extensions.enabled = false;
  });

  afterEach(() => {
    Config.Indexing.excludeFilenameList = [];
  });

  it('should parse metadata', async () => {
    Config.Media.folder = path.join(__dirname, '/../../../assets');
    ProjectPath.ImageFolder = path.join(__dirname, '/../../../assets');
    const dir = await DiskManager.scanDirectory('/');
    // should match the number of media (photo/video) files in the assets folder
    // TODO: make this test less flaky. Every time a new image is added to the folder, it fails.
    expect(dir.media.length).to.be.equals(18);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expected = require(path.join(__dirname, '/../../../assets/test image öüóőúéáű-.,.json'));
    const i = dir.media.findIndex(m => m.name === 'test image öüóőúéáű-.,.jpg');
    expect(Utils.clone(dir.media[i].name)).to.be.deep.equal('test image öüóőúéáű-.,.jpg');
    expect(Utils.clone(dir.media[i].metadata)).to.be.deep.equal(expected);
  });

  describe('excludeFilenameList', () => {
    it('excludeFile should return false when list is empty', () => {
      Config.Indexing.excludeFilenameList = [];
      expect(DiskManager.excludeFile('._photo.jpg')).to.be.false;
      expect(DiskManager.excludeFile('photo.jpg')).to.be.false;
    });

    it('excludeFile should exclude dot-files using glob pattern ".*"', () => {
      Config.Indexing.excludeFilenameList = ['.*'];
      expect(DiskManager.excludeFile('._photo.jpg')).to.be.true;
      expect(DiskManager.excludeFile('.hidden.jpg')).to.be.true;
      expect(DiskManager.excludeFile('photo.jpg')).to.be.false;
      expect(DiskManager.excludeFile('normal_video.mp4')).to.be.false;
    });

    it('excludeFile should exclude files by extension using glob pattern "*.rm"', () => {
      Config.Indexing.excludeFilenameList = ['*.rm'];
      expect(DiskManager.excludeFile('video.rm')).to.be.true;
      expect(DiskManager.excludeFile('VIDEO.RM')).to.be.true; // case insensitive
      expect(DiskManager.excludeFile('video.mp4')).to.be.false;
      expect(DiskManager.excludeFile('video.rm.bak')).to.be.false;
    });

    it('excludeFile should support multiple glob patterns', () => {
      Config.Indexing.excludeFilenameList = ['.*', '*.rm'];
      expect(DiskManager.excludeFile('._photo.jpg')).to.be.true;
      expect(DiskManager.excludeFile('video.rm')).to.be.true;
      expect(DiskManager.excludeFile('photo.jpg')).to.be.false;
    });

    it('excludeFile should support "?" wildcard for single character', () => {
      Config.Indexing.excludeFilenameList = ['photo?.jpg'];
      expect(DiskManager.excludeFile('photo1.jpg')).to.be.true;
      expect(DiskManager.excludeFile('photoA.jpg')).to.be.true;
      expect(DiskManager.excludeFile('photo.jpg')).to.be.false;
      expect(DiskManager.excludeFile('photo12.jpg')).to.be.false;
    });

    it('scanDirectory should exclude files matching glob patterns in excludeFilenameList', async () => {
      Config.Media.folder = path.join(__dirname, '/../../../assets');
      ProjectPath.ImageFolder = path.join(__dirname, '/../../../assets');
      Config.Indexing.excludeFilenameList = ['.*'];
      const dir = await DiskManager.scanDirectory('/');
      // All files starting with '.' should be excluded
      const dotFiles = dir.media.filter(m => m.name.startsWith('.'));
      expect(dotFiles).to.have.length(0);
      // Non-dot files should still be present
      expect(dir.media.length).to.be.greaterThan(0);
    });

    it('scanDirectory should include all files when excludeFilenameList is empty', async () => {
      Config.Media.folder = path.join(__dirname, '/../../../assets');
      ProjectPath.ImageFolder = path.join(__dirname, '/../../../assets');
      Config.Indexing.excludeFilenameList = [];
      const dir = await DiskManager.scanDirectory('/');
      expect(dir.media.length).to.be.equals(18);
    });
  });
});
