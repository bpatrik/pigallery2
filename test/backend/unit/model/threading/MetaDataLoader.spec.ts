/* eslint-disable @typescript-eslint/no-var-requires */
import {expect} from 'chai';
import {MetadataLoader} from '../../../../../src/backend/model/fileaccess/MetadataLoader';
import {Utils} from '../../../../../src/common/Utils';
import * as path from 'path';
import * as fs from 'fs';
import {PhotoProcessing} from '../../../../../src/backend/model/fileaccess/fileprocessing/PhotoProcessing';
import {Config} from '../../../../../src/common/config/private/Config';
import {DatabaseType} from '../../../../../src/common/config/private/PrivateConfig';

declare const before: any;

describe('MetadataLoader', () => {
  // loading default settings (this might have been changed by other tests)

  before(() => {
    Config.loadSync();
    Config.Database.type = DatabaseType.sqlite;
    Config.Faces.enabled = true;
    Config.Faces.keywordsToPersons = true;
    Config.Extensions.enabled = false;
  });


  it('should load png', async () => {
    const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/test_png.png'));
    delete data.creationDate; // creation time for png not supported
    const expected = require(path.join(__dirname, '/../../../assets/test_png.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  it('should load jpg', async () => {
    const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/test image öüóőúéáű-.,.jpg'));
    const expected = require(path.join(__dirname, '/../../../assets/test image öüóőúéáű-.,.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  it('should load miss dated jpg', async () => {
    const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/date_issue.jpg'));
    const expected = require(path.join(__dirname, '/../../../assets/date_issue.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  it('should load xmp section dc:subject into keywords', async () => {
    const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/xmp/xmp_subject.jpg'));
    const expected = require(path.join(__dirname, '/../../../assets/xmp/xmp_subject.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  it('should load Rating and not overwrite its value by RatingPercent', async () => {
    const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/two_ratings.jpg'));
    const expected = require(path.join(__dirname, '/../../../assets/two_ratings.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  it('should load jpg 2', async () => {
    const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/old_photo.jpg'));
    const expected = require(path.join(__dirname, '/../../../assets/old_photo.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  describe('should load jpg with proper height and orientation', () => {
    it('jpg 1', async () => {
      const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/orientation/broken_orientation_exif.jpg'));
      const expected = require(path.join(__dirname, '/../../../assets/orientation/broken_orientation_exif.json'));
      expect(Utils.clone(data)).to.be.deep.equal(expected);
    });
    it('jpg 2', async () => {
      const data = await MetadataLoader.loadPhotoMetadata(
          path.join(__dirname, '/../../../assets/orientation/broken_orientation_exif2.jpg'));
      const expected = require(path.join(__dirname, '/../../../assets/orientation/broken_orientation_exif2.json'));
      expect(Utils.clone(data)).to.be.deep.equal(expected);
    });
  });

  describe('should load jpg with edge case exif data', () => {
    const root = path.join(__dirname, '/../../../assets/edge_case_exif_data');
    const files = fs.readdirSync(root);
    for (const item of files) {
      const fullFilePath = path.join(root, item);
      if (PhotoProcessing.isPhoto(fullFilePath)) {
        it(item, async () => {
          const data = await MetadataLoader.loadPhotoMetadata(fullFilePath);
          const expected = require(fullFilePath.split('.').slice(0, -1).join('.') + '.json');
          if (expected.skip) {
            expected.skip.forEach((s: string) => {
              delete (data as any)[s];
              delete expected[s];
            });
            delete expected.skip;
          }
          expect(Utils.clone(data)).to.be.deep.equal(expected);
        });
      }

    }

  });

  // TODO: deprecated tests. We do not save orientation anymore.
  describe('should read orientation', () => {
    for (let i = 0; i <= 8; ++i) {
      it('Landscape ' + i, async () => {
        const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/orientation/Landscape_' + i + '.jpg'));
        const expected = require(path.join(__dirname, '/../../../assets/orientation/Landscape.json'));
        delete data.fileSize;
        delete data.creationDate;
        expect(Utils.clone(data)).to.be.deep.equal(expected);
      });
      it('Portrait ' + i, async () => {
        const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/orientation/Portrait_' + i + '.jpg'));
        const expected = require(path.join(__dirname, '/../../../assets/orientation/Portrait.json'));
        delete data.fileSize;
        delete data.creationDate;
        expect(Utils.clone(data)).to.be.deep.equal(expected);
      });
    }
  });


  it('should load jpg edited with exiftool', async () => {
    const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/exiftool.jpg'));
    const expected = require(path.join(__dirname, '/../../../assets/exiftool.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  it('should load jpg with provided ImageWidth but missing imageSize', async () => {
    const data = await MetadataLoader.loadPhotoMetadata(path.join(__dirname, '/../../../assets/imageSizeError.jpg'));
    const expected = require(path.join(__dirname, '/../../../assets/imageSizeError.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });


  it('should load mp4', async () => {
    const data = await MetadataLoader.loadVideoMetadata(path.join(__dirname, '/../../../assets/video.mp4'));
    const expected = require(path.join(__dirname, '/../../../assets/video.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  it('should respect mp4 rotate transformation', async () => {
    const data = await MetadataLoader.loadVideoMetadata(path.join(__dirname, '/../../../assets/video_rotate.mp4'));
    const expected = require(path.join(__dirname, '/../../../assets/video_rotate.json'));
    delete data.duration;
    delete expected.duration;
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

  it('should load mkv', async () => {
    const data = await MetadataLoader.loadVideoMetadata(path.join(__dirname, '/../../../assets/video_mkv.mkv'));
    const expected = require(path.join(__dirname, '/../../../assets/video_mkv.json'));
    expect(Utils.clone(data)).to.be.deep.equal(expected);
  });

});
