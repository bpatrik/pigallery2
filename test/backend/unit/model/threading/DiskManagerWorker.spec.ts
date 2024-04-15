import {expect} from 'chai';
import * as path from 'path';
import {Config} from '../../../../../src/common/config/private/Config';
import {ProjectPath} from '../../../../../src/backend/ProjectPath';
import {Utils} from '../../../../../src/common/Utils';
import {DatabaseType} from '../../../../../src/common/config/private/PrivateConfig';
import {DiskManager} from '../../../../../src/backend/model/fileaccess/DiskManager';

declare const before: any;

describe('DiskMangerWorker', () => {
  // loading default settings (this might have been changed by other tests)
  before(() => {
    Config.loadSync();
    Config.Database.type = DatabaseType.sqlite;
    Config.Faces.enabled = true;
    Config.Faces.keywordsToPersons = true;
    Config.Extensions.enabled = false;
  });


  it('should parse metadata', async () => {
    Config.Media.folder = path.join(__dirname, '/../../../assets');
    ProjectPath.ImageFolder = path.join(__dirname, '/../../../assets');
    const dir = await DiskManager.scanDirectory('/');
    // should match the number of media (photo/video) files in the assets folder
    expect(dir.media.length).to.be.equals(16);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expected = require(path.join(__dirname, '/../../../assets/test image öüóőúéáű-.,.json'));
    const i = dir.media.findIndex(m => m.name === 'test image öüóőúéáű-.,.jpg');
    expect(Utils.clone(dir.media[i].name)).to.be.deep.equal('test image öüóőúéáű-.,.jpg');
    expect(Utils.clone(dir.media[i].metadata)).to.be.deep.equal(expected);
  });
});
