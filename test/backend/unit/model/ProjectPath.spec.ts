import {expect} from 'chai';
import * as path from 'path';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {DiskManager} from '../../../../src/backend/model/fileaccess/DiskManager';
import {TestHelper} from '../../../TestHelper';

declare const describe: any;
declare const it: any;
declare const before: any;
declare const after: any;

describe('ProjectPath', () => {
  before(TestHelper.resetConfig);
  const imageFolder = path.resolve(__dirname, 'gallery');
  let origImageFolder: string;

  before(() => {
    origImageFolder = ProjectPath.ImageFolder;
    ProjectPath.ImageFolder = imageFolder;
  });

  after(() => {
    ProjectPath.ImageFolder = origImageFolder;
  });

  describe('isInsideImageFolder', () => {
    it('should accept paths inside the image folder', () => {
      for (const p of ['.', './', 'a', 'a/b.jpg', 'a/../b.jpg', '..foo.jpg',
        imageFolder, path.join(imageFolder, 'a', 'b.jpg')]) {
        expect(ProjectPath.isInsideImageFolder(p), p).to.be.true;
      }
    });

    it('should reject paths outside the image folder', () => {
      for (const p of ['..', '../', '../x.jpg', 'a/../../x.jpg', path.join('..', 'other', 'x.jpg'),
        path.dirname(imageFolder), path.join(imageFolder, '..', 'x.jpg'), imageFolder + 'x']) {
        expect(ProjectPath.isInsideImageFolder(p), p).to.be.false;
      }
    });
  });

  describe('resolveInImageFolder', () => {
    it('should resolve request paths inside the image folder', () => {
      expect(ProjectPath.resolveInImageFolder('')).to.equal(imageFolder);
      expect(ProjectPath.resolveInImageFolder('/')).to.equal(imageFolder);
      expect(ProjectPath.resolveInImageFolder('.')).to.equal(imageFolder);
      expect(ProjectPath.resolveInImageFolder('a/b.jpg')).to.equal(path.join(imageFolder, 'a', 'b.jpg'));
      expect(ProjectPath.resolveInImageFolder('a/../b.jpg')).to.equal(path.join(imageFolder, 'b.jpg'));
      expect(ProjectPath.resolveInImageFolder('..foo.jpg')).to.equal(path.join(imageFolder, '..foo.jpg'));
      expect(ProjectPath.resolveInImageFolder('Árvíztűrő/tükörfúrógép.jpg'))
        .to.equal(path.join(imageFolder, 'Árvíztűrő', 'tükörfúrógép.jpg'));
      // an absolute-looking request path is still relative to the image folder
      expect(ProjectPath.resolveInImageFolder('/a/b.jpg')).to.equal(path.join(imageFolder, 'a', 'b.jpg'));
    });

    it('should reject request paths outside the image folder', () => {
      for (const p of ['..', '../', '../x.jpg', 'a/../../x.jpg', path.join('..', 'other', 'x.jpg'),
        '../' + path.basename(imageFolder) + 'x/a.jpg']) {
        expect(ProjectPath.resolveInImageFolder(p), p).to.be.null;
      }
    });
  });

  describe('DiskManager.scanDirectory', () => {
    it('should refuse to scan outside the image folder', async () => {
      for (const p of ['..', path.join('..', 'other')]) {
        let err: Error = null;
        try {
          await DiskManager.scanDirectory(p);
        } catch (e) {
          err = e;
        }
        expect(err, p).to.not.be.null;
        expect(err.message, p).to.contain('outside of the image folder');
      }
    });
  });
});
