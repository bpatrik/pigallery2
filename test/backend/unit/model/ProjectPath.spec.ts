import {expect} from 'chai';
import * as path from 'path';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {DiskManager} from '../../../../src/backend/model/fileaccess/DiskManager';

declare const describe: any;
declare const it: any;
declare const before: any;
declare const after: any;

describe('ProjectPath', () => {
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
