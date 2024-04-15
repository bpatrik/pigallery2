import {expect} from 'chai';
import {Config} from '../../../../../src/common/config/private/Config';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import * as path from 'path';
import {PhotoProcessing} from '../../../../../src/backend/model/fileaccess/fileprocessing/PhotoProcessing';


describe('PhotoProcessing', () => {

  it('should generate converted gif file path', async () => {

    await Config.load();
    Config.Media.Photo.thumbnailSizes = [];
    ProjectPath.ImageFolder = path.join(__dirname, './../../../assets');
    const gifPath = path.join(ProjectPath.ImageFolder, 'earth.gif');


    for (const thSize of Config.Media.Photo.thumbnailSizes) {
      Config.Media.Photo.animateGif = true;

      expect(await PhotoProcessing
        .isValidConvertedPath(PhotoProcessing.generateConvertedPath(gifPath, thSize)))
        .to.be.true;

      Config.Media.Photo.animateGif = false;
      expect(await PhotoProcessing
        .isValidConvertedPath(PhotoProcessing.generateConvertedPath(gifPath, thSize)))
        .to.be.true;
    }

  });


  /* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
  it('should generate converted thumbnail path', async () => {

    await Config.load();
    Config.Media.Photo.thumbnailSizes = [10, 20];
    ProjectPath.ImageFolder = path.join(__dirname, './../../../assets');
    const photoPath = path.join(ProjectPath.ImageFolder, 'test_png.png');

    for (const thSize of Config.Media.Photo.thumbnailSizes) {
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
