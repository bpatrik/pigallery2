import {expect} from 'chai';
import {Config} from '../../../../../src/common/config/private/Config';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import * as path from 'path';
import {PhotoProcessing} from '../../../../../src/backend/model/fileaccess/fileprocessing/PhotoProcessing';


describe('PhotoProcessing', () => {

  /* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
  it('should generate converted file path', async () => {

    await Config.load();
    Config.Media.Thumbnail.thumbnailSizes = [];
    Config.Media.Thumbnail.animateGif = true;
    ProjectPath.ImageFolder = path.join(__dirname, './../../../assets');
    const photoPath = path.join(ProjectPath.ImageFolder, 'test_png.png');

    expect(await PhotoProcessing
      .isValidConvertedPath(PhotoProcessing.generateConvertedPath(photoPath,
        Config.Media.Photo.Converting.resolution)))
      .to.be.true;

    expect(await PhotoProcessing
      .isValidConvertedPath(PhotoProcessing.generateConvertedPath(photoPath + 'noPath',
        Config.Media.Photo.Converting.resolution)))
      .to.be.false;

    {
      const convertedPath = PhotoProcessing.generateConvertedPath(photoPath,
        Config.Media.Photo.Converting.resolution);
      Config.Media.Photo.Converting.resolution = (1 as any);
      expect(await PhotoProcessing.isValidConvertedPath(convertedPath)).to.be.false;
    }
  });

  it('should generate converted gif file path', async () => {

    await Config.load();
    Config.Media.Thumbnail.thumbnailSizes = [];
    ProjectPath.ImageFolder = path.join(__dirname, './../../../assets');
    const gifPath = path.join(ProjectPath.ImageFolder, 'earth.gif');

    Config.Media.Thumbnail.animateGif = true;
    expect(await PhotoProcessing
      .isValidConvertedPath(PhotoProcessing.generateConvertedPath(gifPath,
        Config.Media.Photo.Converting.resolution)))
      .to.be.true;

    Config.Media.Thumbnail.animateGif = false;
    expect(await PhotoProcessing
      .isValidConvertedPath(PhotoProcessing.generateConvertedPath(gifPath,
        Config.Media.Photo.Converting.resolution)))
      .to.be.true;

  });


  /* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
  it('should generate converted thumbnail path', async () => {

    await Config.load();
    Config.Media.Photo.Converting.resolution = (null as any);
    Config.Media.Thumbnail.thumbnailSizes = [10, 20];
    ProjectPath.ImageFolder = path.join(__dirname, './../../../assets');
    const photoPath = path.join(ProjectPath.ImageFolder, 'test_png.png');

    for (const thSize of Config.Media.Thumbnail.thumbnailSizes) {
      expect(await PhotoProcessing
        .isValidConvertedPath(PhotoProcessing.generateConvertedPath(photoPath, thSize)))
        .to.be.true;


      expect(await PhotoProcessing
        .isValidConvertedPath(PhotoProcessing.generateConvertedPath(photoPath + 'noPath', thSize)))
        .to.be.false;
    }


    expect(await PhotoProcessing
      .isValidConvertedPath(PhotoProcessing.generateConvertedPath(photoPath, 30)))
      .to.be.false;

  });

});
