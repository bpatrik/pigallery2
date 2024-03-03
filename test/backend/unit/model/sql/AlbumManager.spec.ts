import {DBTestHelper} from '../../../DBTestHelper';
import {ParentDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {AlbumManager} from '../../../../../src/backend/model/database/AlbumManager';
import {SearchQueryTypes, TextSearch} from '../../../../../src/common/entities/SearchQueryDTO';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';
import {AlbumBaseEntity} from '../../../../../src/backend/model/database/enitites/album/AlbumBaseEntity';
import {Utils} from '../../../../../src/common/Utils';
import {MediaDTO} from '../../../../../src/common/entities/MediaDTO';
import {SavedSearchDTO} from '../../../../../src/common/entities/album/SavedSearchDTO';


// eslint-disable-next-line @typescript-eslint/no-var-requires
const deepEqualInAnyOrder = require('deep-equal-in-any-order');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chai = require('chai');

chai.use(deepEqualInAnyOrder);
const {expect} = chai;

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
declare const before: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe(); // fake it os IDE plays nicely (recognize the test)


describe('AlbumManager', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;


  const setUpSqlDB = async () => {
    await sqlHelper.initDB();
    await sqlHelper.setUpTestGallery();
    await ObjectManagers.getInstance().init();
  };


  const toAlbumCover = (m: MediaDTO): MediaDTO => {
    // generated dirs for test contain everything, not like return values from the server.
    const tmpDir: ParentDirectoryDTO = m.directory as ParentDirectoryDTO;
    const tmpM = tmpDir.media;
    const tmpD = tmpDir.directories;
    const tmpP = tmpDir.cover;
    const tmpMT = tmpDir.metaFile;
    delete tmpDir.directories;
    delete tmpDir.media;
    delete tmpDir.cover;
    delete tmpDir.metaFile;
    const ret = Utils.clone(m);
    delete ret.id;
    ret.directory = {path: ret.directory.path, name: ret.directory.name};
    delete ret.metadata;
    tmpDir.directories = tmpD;
    tmpDir.media = tmpM;
    tmpDir.cover = tmpP;
    tmpDir.metaFile = tmpMT;
    return ret;
  };


  before(setUpSqlDB);
  after(sqlHelper.clearDB);

  describe('Saved search', () => {


    beforeEach(setUpSqlDB);
    afterEach(sqlHelper.clearDB);

    it('should add album', async () => {
      const am = new AlbumManager();
      const connection = await SQLConnection.getConnection();

      const query: TextSearch = {text: 'test', type: SearchQueryTypes.any_text};

      expect(await connection.getRepository(AlbumBaseEntity).find()).to.deep.equalInAnyOrder([]);

      await am.addSavedSearch('Test Album', Utils.clone(query));

      expect(await connection.getRepository(AlbumBaseEntity).find()).to.deep.equalInAnyOrder([{
        id: 1,
        name: 'Test Album',
        locked: false,
        count: 0,
        searchQuery: query
      } as SavedSearchDTO]);
    });

    it('should delete album', async () => {
      const am = new AlbumManager();
      const connection = await SQLConnection.getConnection();

      const query: TextSearch = {text: 'test', type: SearchQueryTypes.any_text};


      await am.addSavedSearch('Test Album', Utils.clone(query));
      await am.addSavedSearch('Test Album2', Utils.clone(query), true);

      expect(await connection.getRepository(AlbumBaseEntity).find()).to.deep.equalInAnyOrder([
        {
          id: 1,
          name: 'Test Album',
          locked: false,
          count: 0,
          searchQuery: query
        } as SavedSearchDTO,
        {
          id: 2,
          name: 'Test Album2',
          locked: true,
          count: 0,
          searchQuery: query
        } as SavedSearchDTO]);

      await am.deleteAlbum(1);
      expect(await connection.getRepository(AlbumBaseEntity).find()).to.deep.equalInAnyOrder([{
        id: 2,
        name: 'Test Album2',
        locked: true,
        count: 0,
        searchQuery: query
      } as SavedSearchDTO]);

      try {
        await am.deleteAlbum(2);
        expect(false).to.be.equal(true); // should not reach
      } catch (e) {
        expect(e.message).to.equal('Could not delete album, id:2');
      }
      expect(await connection.getRepository(AlbumBaseEntity).find()).to.deep.equalInAnyOrder([{
        id: 2,
        name: 'Test Album2',
        locked: true,
        count: 0,
        searchQuery: query
      } as SavedSearchDTO]);
    });
  });

  it('should list album', async () => {
    const am = new AlbumManager();

    const query: TextSearch = {text: 'photo1', type: SearchQueryTypes.any_text};

    await am.addSavedSearch('Test Album', Utils.clone(query));

    expect(await am.getAlbums()).to.deep.equalInAnyOrder(([{
      id: 1,
      name: 'Test Album',
      searchQuery: query,
      locked: false,
      count: 1,
      cover: toAlbumCover(sqlHelper.testGalleyEntities.p)
    } as SavedSearchDTO]));


  });


});
