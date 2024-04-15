import {LocationManager} from '../../../../../src/backend/model/database/LocationManager';
import {SearchManager} from '../../../../../src/backend/model/database/SearchManager';
import {SearchResultDTO} from '../../../../../src/common/entities/SearchResultDTO';
import {Utils} from '../../../../../src/common/Utils';
import {DBTestHelper} from '../../../DBTestHelper';
import {
  ANDSearchQuery,
  DatePatternFrequency,
  DatePatternSearch,
  DistanceSearch,
  FromDateSearch,
  MaxPersonCountSearch,
  MaxRatingSearch,
  MaxResolutionSearch,
  MinPersonCountSearch,
  MinRatingSearch,
  MinResolutionSearch,
  OrientationSearch,
  ORSearchQuery,
  SearchListQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  ToDateSearch
} from '../../../../../src/common/entities/SearchQueryDTO';
import {IndexingManager} from '../../../../../src/backend/model/database/IndexingManager';
import {DirectoryBaseDTO, ParentDirectoryDTO, SubDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {TestHelper} from '../../../../TestHelper';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {GalleryManager} from '../../../../../src/backend/model/database/GalleryManager';
import {Connection} from 'typeorm';
import {GPSMetadata, PhotoDTO, PhotoMetadata} from '../../../../../src/common/entities/PhotoDTO';
import {VideoDTO} from '../../../../../src/common/entities/VideoDTO';
import {AutoCompleteItem} from '../../../../../src/common/entities/AutoCompleteItem';
import {Config} from '../../../../../src/common/config/private/Config';
import {SearchQueryParser} from '../../../../../src/common/SearchQueryParser';
import {FileDTO} from '../../../../../src/common/entities/FileDTO';
import {SortByTypes} from '../../../../../src/common/entities/SortingMethods';
import {LogLevel} from '../../../../../src/common/config/private/PrivateConfig';

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


class IndexingManagerTest extends IndexingManager {

  public async saveToDB(scannedDirectory: ParentDirectoryDTO): Promise<void> {
    return super.saveToDB(scannedDirectory);
  }
}

class SearchManagerTest extends SearchManager {

  public flattenSameOfQueries(query: SearchQueryDTO): SearchQueryDTO {
    return super.flattenSameOfQueries(query);
  }

}

class GalleryManagerTest extends GalleryManager {

  public async getDirIdAndTime(connection: Connection, directoryName: string, directoryParent: string) {
    return super.getDirIdAndTime(connection, directoryName, directoryParent);
  }

  public async getParentDirFromId(connection: Connection, dir: number): Promise<ParentDirectoryDTO> {
    return super.getParentDirFromId(connection, dir);
  }
}

describe('SearchManager', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;
  /**
   * dir
   * |- v
   * |- p
   * |- p2
   * |- gpx
   * |-> subDir
   *     |- pFaceLess
   * |-> subDir2
   *     |- p4
   */

  let dir: ParentDirectoryDTO;
  let subDir: SubDirectoryDTO;
  let subDir2: SubDirectoryDTO;
  let v: VideoDTO;
  let p: PhotoDTO;
  let p2: PhotoDTO;
  let pFaceLess: PhotoDTO;
  let p4: PhotoDTO;
//  let p5: PhotoDTO;
  // let p6: PhotoDTO;
  let gpx: FileDTO;


  const setUpTestGallery = async (): Promise<void> => {
    const directory: ParentDirectoryDTO = TestHelper.getDirectoryEntry();
    subDir = TestHelper.getDirectoryEntry(directory, 'The Phantom Menace');
    subDir2 = TestHelper.getDirectoryEntry(directory, 'Return of the Jedi');
    p = TestHelper.getPhotoEntry1(directory);
    p.metadata.creationDate = Date.now();
    p.metadata.creationDateOffset = "+02:00";
    p2 = TestHelper.getPhotoEntry2(directory);
    p2.metadata.creationDate = Date.now() - 60 * 60 * 24 * 1000;
    p2.metadata.creationDateOffset = "+02:00";
    v = TestHelper.getVideoEntry1(directory);
    v.metadata.creationDate = Date.now() - 60 * 60 * 24 * 7 * 1000;
    v.metadata.creationDateOffset = "+02:00";
    gpx = TestHelper.getRandomizedGPXEntry(directory);
    p4 = TestHelper.getPhotoEntry4(subDir2);
    let d = new Date();
    //set creation date to one year and one day earlier
    p4.metadata.creationDate = d.getTime() - 60 * 60 * 24 * (Utils.isDateFromLeapYear(d) ? 367 : 366) * 1000;
    p4.metadata.creationDateOffset = "+02:00";
    const pFaceLessTmp = TestHelper.getPhotoEntry3(subDir);
    delete pFaceLessTmp.metadata.faces;
    d = new Date();
    //we create a date 1 month and 1 day before now
    d = Utils.addMonthToDate(d, -1); //subtract 1 month in the "human way"
    d.setDate(d.getDate()-1); //subtract 1 day
    pFaceLessTmp.metadata.creationDate = d.getTime();
    pFaceLessTmp.metadata.creationDateOffset = "+02:00";

    dir = await DBTestHelper.persistTestDir(directory);
    subDir = dir.directories[0];
    subDir2 = dir.directories[1];
    p = (dir.media.filter(m => m.name === p.name)[0] as any);
    p.directory = dir;
    p2 = (dir.media.filter(m => m.name === p2.name)[0] as any);
    p2.directory = dir;
    gpx = (dir.metaFile[0] as any);
    gpx.directory = dir;
    v = (dir.media.filter(m => m.name === v.name)[0] as any);
    v.directory = dir;
    p4 = (dir.directories[1].media[0] as any);
    p4.directory = dir.directories[1];
    pFaceLess = (dir.directories[0].media[0] as any);
    pFaceLess.directory = dir.directories[0];
  };

  const setUpSqlDB = async () => {
    await sqlHelper.initDB();
    await setUpTestGallery();
    await ObjectManagers.getInstance().init();
  };


  before(async () => {
    await setUpSqlDB();
    Config.Search.listDirectories = true;
    Config.Search.listMetafiles = false;
  });


  after(async () => {
    await sqlHelper.clearDB();
    Config.Search.listDirectories = false;
    Config.Search.listMetafiles = false;
  });

  it('should get autocomplete', async () => {
    const sm = new SearchManager();

    const cmp = (a: AutoCompleteItem, b: AutoCompleteItem) => {
      if (a.text === b.text) {
        return a.type - b.type;
      }
      return a.text.localeCompare(b.text);
    };

    expect((await sm.autocomplete('tat', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('Tatooine', SearchQueryTypes.position)]);
    expect((await sm.autocomplete('star', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('star wars', SearchQueryTypes.keyword),
      new AutoCompleteItem('death star', SearchQueryTypes.keyword)]);

    expect((await sm.autocomplete('wars', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('star wars', SearchQueryTypes.keyword),
      new AutoCompleteItem('wars dir', SearchQueryTypes.directory)]);

    expect((await sm.autocomplete('arch', SearchQueryTypes.any_text))).eql([
      new AutoCompleteItem('Research City', SearchQueryTypes.position)]);

    Config.Search.AutoComplete.ItemsPerCategory.maxItems = 99999;
    expect((await sm.autocomplete('wa', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('star wars', SearchQueryTypes.keyword),
      new AutoCompleteItem('Anakin Skywalker', SearchQueryTypes.person),
      new AutoCompleteItem('Luke Skywalker', SearchQueryTypes.person),
      new AutoCompleteItem('wars dir', SearchQueryTypes.directory)]);

    Config.Search.AutoComplete.ItemsPerCategory.maxItems = 1;
    expect((await sm.autocomplete('a', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('Han Solo', SearchQueryTypes.person),
      new AutoCompleteItem('Han Solo\'s dice', SearchQueryTypes.caption),
      new AutoCompleteItem('Research City', SearchQueryTypes.position),
      new AutoCompleteItem('death star', SearchQueryTypes.keyword),
      new AutoCompleteItem('wars dir', SearchQueryTypes.directory)]);
    Config.Search.AutoComplete.ItemsPerCategory.maxItems = 5;
    Config.Search.AutoComplete.ItemsPerCategory.fileName = 5;
    Config.Search.AutoComplete.ItemsPerCategory.fileName = 5;

    expect((await sm.autocomplete('sw', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('sw1.jpg', SearchQueryTypes.file_name),
      new AutoCompleteItem('sw2.jpg', SearchQueryTypes.file_name),
      new AutoCompleteItem('sw3.jpg', SearchQueryTypes.file_name),
      new AutoCompleteItem('sw4.jpg', SearchQueryTypes.file_name),
      new AutoCompleteItem(v.name, SearchQueryTypes.file_name)]);

    expect((await sm.autocomplete(v.name, SearchQueryTypes.any_text))).to.deep.equalInAnyOrder(
      [new AutoCompleteItem(v.name, SearchQueryTypes.file_name)]);

  });

  const searchifyMedia = <T extends FileDTO | PhotoDTO>(m: T): T => {
    const tmpDir: DirectoryBaseDTO = m.directory as DirectoryBaseDTO;
    const tmpM = tmpDir.media;
    const tmpD = tmpDir.directories;
    const tmpP = tmpDir.cover;
    const tmpMT = tmpDir.metaFile;
    delete tmpDir.directories;
    delete tmpDir.media;
    delete tmpDir.cover;
    delete tmpDir.validCover;
    delete tmpDir.metaFile;
    const ret = Utils.clone(m);
    delete (ret.directory as DirectoryBaseDTO).lastScanned;
    delete (ret.directory as DirectoryBaseDTO).lastModified;
    delete (ret.directory as DirectoryBaseDTO).mediaCount;
    delete (ret.directory as DirectoryBaseDTO).youngestMedia;
    delete (ret.directory as DirectoryBaseDTO).oldestMedia;
    if ((ret as PhotoDTO).metadata &&
      ((ret as PhotoDTO).metadata as PhotoMetadata).faces && !((ret as PhotoDTO).metadata as PhotoMetadata).faces.length) {
      delete ((ret as PhotoDTO).metadata as PhotoMetadata).faces;
    }
    tmpDir.directories = tmpD;
    tmpDir.media = tmpM;
    tmpDir.cover = tmpP;
    tmpDir.metaFile = tmpMT;
    return ret;
  };

  const searchifyDir = (d: DirectoryBaseDTO): DirectoryBaseDTO => {
    const tmpM = d.media;
    const tmpD = d.directories;
    const tmpP = d.cover;
    const tmpMT = d.metaFile;
    delete d.directories;
    delete d.media;
    delete d.metaFile;
    const ret = Utils.clone(d);
    d.directories = tmpD;
    d.media = tmpM;
    d.cover = tmpP;
    d.metaFile = tmpMT;
    ret.isPartial = true;
    return ret;
  };

  const removeDir = (result: SearchResultDTO) => {
    result.media = result.media.map(m => searchifyMedia(m));
    result.metaFile = result.metaFile.map(m => searchifyMedia(m));
    result.directories = result.directories.map(m => searchifyDir(m) as SubDirectoryDTO);
    return Utils.clone(result);
  };

  describe('advanced search', async () => {
    afterEach(async () => {
      Config.Search.listDirectories = false;
      Config.Search.listMetafiles = false;
    });
    afterEach(async () => {
      Config.Search.listDirectories = false;
      Config.Search.listMetafiles = false;
    });

    it('should AND', async () => {
      const sm = new SearchManager();

      let query: SearchQueryDTO = {
        type: SearchQueryTypes.AND,
        list: [{text: p.metadata.faces[0].name, type: SearchQueryTypes.person} as TextSearch,
          {text: p2.metadata.caption, type: SearchQueryTypes.caption} as TextSearch]
      } as ANDSearchQuery;

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
      query = ({
        type: SearchQueryTypes.AND,
        list: [{text: p.metadata.faces[0].name, type: SearchQueryTypes.person} as TextSearch,
          {text: p.metadata.caption, type: SearchQueryTypes.caption} as TextSearch]
      } as ANDSearchQuery);
      expect(await sm.search(query)).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      // make sure that this shows both photos. We need this the the rest of the tests
      query = ({text: 'a', type: SearchQueryTypes.person} as TextSearch);
      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        type: SearchQueryTypes.AND,
        list: [{
          type: SearchQueryTypes.AND,
          list: [{text: 'a', type: SearchQueryTypes.person} as TextSearch,
            {text: p.metadata.keywords[0], type: SearchQueryTypes.keyword} as TextSearch]
        } as ANDSearchQuery,
          {text: p.metadata.caption, type: SearchQueryTypes.caption} as TextSearch
        ]
      } as ANDSearchQuery);

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });

    it('should OR', async () => {
      const sm = new SearchManager();

      let query: SearchQueryDTO = {
        type: SearchQueryTypes.OR,
        list: [{text: 'Not a person', type: SearchQueryTypes.person} as TextSearch,
          {text: 'Not a caption', type: SearchQueryTypes.caption} as TextSearch]
      } as ORSearchQuery;

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
      query = ({
        type: SearchQueryTypes.OR,
        list: [{text: p.metadata.faces[0].name, type: SearchQueryTypes.person} as TextSearch,
          {text: p2.metadata.caption, type: SearchQueryTypes.caption} as TextSearch]
      } as ORSearchQuery);
      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        type: SearchQueryTypes.OR,
        list: [{text: p.metadata.faces[0].name, type: SearchQueryTypes.person} as TextSearch,
          {text: p.metadata.caption, type: SearchQueryTypes.caption} as TextSearch]
      } as ORSearchQuery);
      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      // make sure that this shows both photos. We need this the the rest of the tests
      query = ({text: 'a', type: SearchQueryTypes.person} as TextSearch);
      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        type: SearchQueryTypes.OR,
        list: [{
          type: SearchQueryTypes.OR,
          list: [{text: 'a', type: SearchQueryTypes.person} as TextSearch,
            {text: p.metadata.keywords[0], type: SearchQueryTypes.keyword} as TextSearch]
        } as ORSearchQuery,
          {text: p.metadata.caption, type: SearchQueryTypes.caption} as TextSearch
        ]
      } as ORSearchQuery);

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


      query = ({
        type: SearchQueryTypes.OR,
        list: [{
          type: SearchQueryTypes.OR,
          list: [{text: p.metadata.keywords[0], type: SearchQueryTypes.keyword} as TextSearch,
            {text: p2.metadata.keywords[0], type: SearchQueryTypes.keyword} as TextSearch]
        } as ORSearchQuery,
          {text: pFaceLess.metadata.caption, type: SearchQueryTypes.caption} as TextSearch
        ]
      } as ORSearchQuery);

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });

    it('should minimum of', async () => {
      const sm = new SearchManager();

      let query: SomeOfSearchQuery = {
        type: SearchQueryTypes.SOME_OF,
        list: [{text: 'jpg', type: SearchQueryTypes.file_name} as TextSearch,
          {text: 'mp4', type: SearchQueryTypes.file_name} as TextSearch]
      } as SomeOfSearchQuery;

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess, p4, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        type: SearchQueryTypes.SOME_OF,
        list: [{text: 'R2', type: SearchQueryTypes.person} as TextSearch,
          {text: 'Anakin', type: SearchQueryTypes.person} as TextSearch,
          {text: 'Luke', type: SearchQueryTypes.person} as TextSearch]
      } as SomeOfSearchQuery);

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


      query.min = 2;

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query.min = 3;

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        type: SearchQueryTypes.SOME_OF,
        min: 3,
        list: [{text: 'sw', type: SearchQueryTypes.file_name} as TextSearch,
          {text: 'R2', type: SearchQueryTypes.person} as TextSearch,
          {text: 'Kamino', type: SearchQueryTypes.position} as TextSearch,
          {text: 'Han', type: SearchQueryTypes.person} as TextSearch]
      } as SomeOfSearchQuery);

      expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });

    describe('should search text', async () => {
      it('as any', async () => {
        const sm = new SearchManager();

        let query = {text: 'sw', type: SearchQueryTypes.any_text} as TextSearch;
        expect(Utils.clone(await sm.search({text: 'sw', type: SearchQueryTypes.any_text} as TextSearch)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, v, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({text: 'sw', negate: true, type: SearchQueryTypes.any_text} as TextSearch);

        expect(removeDir(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({text: 'Boba', type: SearchQueryTypes.any_text} as TextSearch);

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({text: 'Boba', negate: true, type: SearchQueryTypes.any_text} as TextSearch);
        expect(removeDir(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p2, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({text: 'Boba', negate: true, type: SearchQueryTypes.any_text} as TextSearch);
        // all should have faces
        const sRet = await sm.search(query);
        for (const item of sRet.media) {
          if (item.id === pFaceLess.id) {
            continue;
          }

          expect((item as PhotoDTO).metadata.faces).to.be.not.an('undefined');
          expect((item as PhotoDTO).metadata.faces).to.be.lengthOf.above(1);
        }


        query = ({
          text: 'Boba',
          type: SearchQueryTypes.any_text,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch);
        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({
          text: 'Boba Fett',
          type: SearchQueryTypes.any_text,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch);

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

      });

      it('as position', async () => {
        const sm = new SearchManager();


        const query = {text: 'Tatooine', type: SearchQueryTypes.position} as TextSearch;
        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });


      it('as keyword', async () => {
        const sm = new SearchManager();


        let query = {
          text: 'kie',
          type: SearchQueryTypes.keyword
        } as TextSearch;
        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p2, pFaceLess],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          text: 'wa',
          type: SearchQueryTypes.keyword
        } as TextSearch);

        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          text: 'han',
          type: SearchQueryTypes.keyword
        } as TextSearch);

        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          text: 'star wars',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.keyword
        } as TextSearch);

        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          text: 'wookiees',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.keyword
        } as TextSearch);

        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [pFaceLess],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });


      it('as caption', async () => {
        const sm = new SearchManager();


        const query = {
          text: 'han',
          type: SearchQueryTypes.caption
        } as TextSearch;

        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));
      });

      it('as file_name', async () => {
        const sm = new SearchManager();

        let query = {
          text: 'sw',
          type: SearchQueryTypes.file_name
        } as TextSearch;


        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, v, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          text: 'sw4',
          type: SearchQueryTypes.file_name
        } as TextSearch);

        expect(Utils.clone(await sm.search({
          text: 'sw4',
          type: SearchQueryTypes.file_name
        } as TextSearch))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });

      it('as directory', async () => {
        const sm = new SearchManager();

        let query = {
          text: 'of the J',
          type: SearchQueryTypes.directory
        } as TextSearch;

        expect(removeDir(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({
          text: 'wars dir',
          type: SearchQueryTypes.directory
        } as TextSearch);

        expect(removeDir(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, v, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({
          text: '/wars dir',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.directory
        } as TextSearch);


        expect(removeDir(await sm.search({
          text: '/wars dir',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.directory
        } as TextSearch))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, v],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));


        query = ({
          text: '/wars dir/Return of the Jedi',
          //    matchType: TextSearchQueryMatchTypes.like,
          type: SearchQueryTypes.directory
        } as TextSearch);

        expect(removeDir(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({
          text: '/wars dir/Return of the Jedi',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.directory
        } as TextSearch);

        expect(removeDir(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));


      });

      it('as person', async () => {
        const sm = new SearchManager();

        let query = {
          text: 'Boba',
          type: SearchQueryTypes.person
        } as TextSearch;

        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          text: 'Boba',
          type: SearchQueryTypes.person,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch);

        expect(Utils.clone(await sm.search(query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          text: 'Boba Fett',
          type: SearchQueryTypes.person,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch);

        expect(Utils.clone(await sm.search({
          text: 'Boba Fett',
          type: SearchQueryTypes.person,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });

    });


    it('should search date', async () => {
      const sm = new SearchManager();

      let query: any = {value: 0, type: SearchQueryTypes.to_date} as ToDateSearch;

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        value: p2.metadata.creationDate, type: SearchQueryTypes.from_date
      } as FromDateSearch);

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        value: p.metadata.creationDate,
        negate: true,
        type: SearchQueryTypes.from_date
      } as FromDateSearch);

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p2, pFaceLess, p4, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        value: p.metadata.creationDate + 1000000000,
        type: SearchQueryTypes.to_date
      } as ToDateSearch);

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess, v, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });
    describe('search date pattern', async () => {
      let p5: PhotoDTO;
      let p6: PhotoDTO;
      let p7: PhotoDTO;
      let sm: SearchManager;

      before(async () => {
        await sqlHelper.clearDB();
        await setUpSqlDB();
        p5 = TestHelper.getBasePhotoEntry(subDir2, 'p5-23h-ago.jpg');
        p5.metadata.creationDate = Date.now() - 60 * 60 * 24 * 1000 - 1000;
        //p5.metadata.creationDateOffset = "+02:00";
        p6 = TestHelper.getBasePhotoEntry(subDir2, 'p6-300d-ago.jpg');
        p6.metadata.creationDate = Date.now() - 60 * 60 * 24 * 300 * 1000;
        //p6.metadata.creationDateOffset = "+02:00";
        p7 = TestHelper.getBasePhotoEntry(subDir2, 'p7-1y-1min-ago.jpg');
        const d = new Date();
        d.setUTCFullYear(d.getUTCFullYear() - 1);
        d.setUTCMinutes(d.getUTCMinutes() - 1);
        p7.metadata.creationDate = d.getTime();
        //p7.metadata.creationDateOffset = "+02:00";

        subDir2 = await DBTestHelper.persistTestDir(subDir2) as any;
        p4 = subDir2.media[0];
        p4.directory = subDir2;
        p5 = subDir2.media[1];
        p5.directory = subDir2;
        p6 = subDir2.media[2];
        p6.directory = subDir2;
        p7 = subDir2.media[3];
        p7.directory = subDir2;
        Config.Search.listDirectories = false;
        Config.Search.listMetafiles = false;

        sm = new SearchManager();
      });

      //TODO: this is flaky test for mysql
      it('last-0-days:every-year', async () => {


        let query: DatePatternSearch = {
          daysLength: 0,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        };

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = {
          daysLength: 0,
          negate: true,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        };

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p2, p4, pFaceLess, v, p5, p6],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });

      //TODO: this is flaky test for mysql
      it('last-1-days:every-year', async () => {
        let query: DatePatternSearch = {
          daysLength: 1,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));


        query = {
          daysLength: 1,
          negate: true,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p2, p4, pFaceLess, v, p5, p6],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });
      it('last-2-days:every-year', async () => {
        let query = {
          daysLength: 2,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, p4, p5, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = {
          daysLength: 2,
          negate: true,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [v, pFaceLess, p6],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });
      it('last-1-days:10-days-ago', async () => {

        let query = {
          daysLength: 1,
          agoNumber: 10,
          frequency: DatePatternFrequency.days_ago,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));


        query = {
          daysLength: 1,
          agoNumber: 10,
          negate: true,
          frequency: DatePatternFrequency.days_ago,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, p4, pFaceLess, v, p5, p6, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });
      it('last-3-days:1-month-ago', async () => {
        let query = {
          daysLength: 3,
          agoNumber: 1,
          frequency: DatePatternFrequency.months_ago,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [pFaceLess],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = {
          daysLength: 3,
          agoNumber: 1,
          negate: true,
          frequency: DatePatternFrequency.months_ago,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, p4, v, p5, p6, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });

      it('last-3-days:12-month-ago', async () => {
        let query = {
          daysLength: 3,
          agoNumber: 12,
          frequency: DatePatternFrequency.months_ago,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p4, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = {
          daysLength: 3,
          agoNumber: 12,
          negate: true,
          frequency: DatePatternFrequency.months_ago,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, v, p5, p6, pFaceLess],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });
      it('last-366-days:every-year', async () => {
        let query = {
          daysLength: 366,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, p4, pFaceLess, v, p5, p6, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = {
          daysLength: 366,
          negate: true,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });
      it('last-32-days:every-month', async () => {
        const query = {
          daysLength: 32,
          frequency: DatePatternFrequency.every_month,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, p4, pFaceLess, v, p5, p6, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));


      });
      it('last-364-days:every-year', async () => {
        let query = {
          daysLength: 364,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, p4, pFaceLess, v, p5, p6, p7],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = {
          daysLength: 364,
          negate: true,
          frequency: DatePatternFrequency.every_year,
          type: SearchQueryTypes.date_pattern
        } as DatePatternSearch;

        expect(Utils.clone(await sm.search(query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));


      });
    });

    it('should search rating', async () => {
      const sm = new SearchManager();

      let query: MinRatingSearch | MaxRatingSearch = {value: 0, type: SearchQueryTypes.max_rating} as MaxRatingSearch;


      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 5, type: SearchQueryTypes.max_rating} as MaxRatingSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 5, negate: true, type: SearchQueryTypes.max_rating} as MaxRatingSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 2, type: SearchQueryTypes.min_rating} as MinRatingSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p2, pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 2, negate: true, type: SearchQueryTypes.min_rating} as MinRatingSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
    });


    it('should search person count', async () => {
      const sm = new SearchManager();

      let query: MinPersonCountSearch | MaxPersonCountSearch = {value: 0, type: SearchQueryTypes.max_person_count} as MaxPersonCountSearch;


      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [pFaceLess, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 20, type: SearchQueryTypes.max_person_count} as MaxPersonCountSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess, p4, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 20, negate: true, type: SearchQueryTypes.max_person_count} as MaxPersonCountSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


      query = ({value: 4, type: SearchQueryTypes.max_person_count} as MaxPersonCountSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p2, p4, pFaceLess, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 2, type: SearchQueryTypes.min_person_count} as MinPersonCountSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 6, type: SearchQueryTypes.min_person_count} as MinPersonCountSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 2, negate: true, type: SearchQueryTypes.min_person_count} as MinPersonCountSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [v, pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
    });

    it('should search resolution', async () => {
      const sm = new SearchManager();

      let query: MinResolutionSearch | MaxResolutionSearch =
        {value: 0, type: SearchQueryTypes.max_resolution} as MaxResolutionSearch;

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 1, type: SearchQueryTypes.max_resolution} as MaxResolutionSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 3, type: SearchQueryTypes.min_resolution} as MinResolutionSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


      query = ({value: 3, negate: true, type: SearchQueryTypes.min_resolution} as MinResolutionSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({value: 3, negate: true, type: SearchQueryTypes.max_resolution} as MaxResolutionSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });


    it('should search orientation', async () => {
      const sm = new SearchManager();

      let query = {
        landscape: false,
        type: SearchQueryTypes.orientation
      } as OrientationSearch;
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        landscape: true,
        type: SearchQueryTypes.orientation
      } as OrientationSearch);
      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, pFaceLess, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


    });

    it('should search distance', async () => {
      ObjectManagers.getInstance().LocationManager = new LocationManager();
      const sm = new SearchManager();

      ObjectManagers.getInstance().LocationManager.getGPSData = async (): Promise<GPSMetadata> => {
        return {
          longitude: 10,
          latitude: 10
        };
      };

      let query = {
        from: {text: 'Tatooine'},
        distance: 1,
        type: SearchQueryTypes.distance
      } as DistanceSearch;

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        from: {GPSData: {latitude: 0, longitude: 0}},
        distance: 112 * 10, // number of km per degree = ~111km
        type: SearchQueryTypes.distance
      } as DistanceSearch);

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        from: {GPSData: {latitude: 0, longitude: 0}},
        distance: 112 * 10, // number of km per degree = ~111km
        negate: true,
        type: SearchQueryTypes.distance
      } as DistanceSearch);

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [pFaceLess, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
      query = ({
        from: {GPSData: {latitude: 10, longitude: 10}},
        distance: 1,
        type: SearchQueryTypes.distance
      } as DistanceSearch);

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        from: {GPSData: {latitude: 10, longitude: 10}},
        distance: 112 * 5, // number of km per degree = ~111km
        type: SearchQueryTypes.distance
      } as DistanceSearch);

      expect(Utils.clone(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, pFaceLess, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });

    /**
     * flattenSameOfQueries  converts some-of queries to AND and OR queries
     * E.g.:
     * 2-of:(A B C) to (A and (B or C)) or (B and C)
     * this tests makes sure that all queries has at least 2 constraints
     */
    (it('should flatter SOME_OF query', () => {
      const sm = new SearchManagerTest();
      const parser = new SearchQueryParser();
      const alphabet = 'abcdefghijklmnopqrstu';


      const shortestDepth = (q: SearchQueryDTO): number => {
        let depth = 0;
        if ((q as SearchListQuery).list) {
          if (q.type === SearchQueryTypes.AND) {
            for (const l of (q as SearchListQuery).list) {
              depth += shortestDepth(l);
            }
            return depth;
          }
          // it's an OR
          const lengths = (q as SearchListQuery).list.map(l => shortestDepth(l)).sort();
          return lengths[0];
        }
        return 1;
      };

      const checkBoolLogic = (q: SearchQueryDTO) => {
        if ((q as SearchListQuery).list) {
          expect((q as SearchListQuery).list).to.not.equal(1);
          for (const l of (q as SearchListQuery).list) {
            checkBoolLogic(l);
          }
        }
      };

      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 1; i < alphabet.length / 2; ++i) {
        const query: SomeOfSearchQuery = {
          type: SearchQueryTypes.SOME_OF,
          min: i,
          //
          list: alphabet.split('').map(t => ({
            type: SearchQueryTypes.file_name,
            text: t
          } as TextSearch))
        };
        const q = sm.flattenSameOfQueries(query);
        expect(shortestDepth(q)).to.equal(i, parser.stringify(query) + '\n' + parser.stringify(q));
        checkBoolLogic(q);
      }
    }) as any).timeout(20000);

    (it('should execute complex SOME_OF query', async () => {
      const sm = new SearchManager();

      const query: SomeOfSearchQuery = {
        type: SearchQueryTypes.SOME_OF,
        min: 5,
        //
        list: 'abcdefghijklmnopqrstu'.split('').map(t => ({
          type: SearchQueryTypes.file_name,
          text: t
        } as TextSearch))
      };
      expect(removeDir(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
    }) as any).timeout(40000);

    it('search result should return directory', async () => {
      Config.Search.listDirectories = true;
      const sm = new SearchManager();

      const cloned = Utils.clone(searchifyDir(subDir));
      cloned.validCover = true;
      cloned.cover = {
        directory: {
          name: subDir.name,
          path: subDir.path
        },
        name: pFaceLess.name
      } as any;
      const query = {
        text: subDir.name,
        type: SearchQueryTypes.any_text
      } as TextSearch;
      expect(removeDir(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [cloned],
        media: [pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
    });
    it('search result should return meta files', async () => {
      Config.Search.listMetafiles = true;
      const sm = new SearchManager();

      const query = {
        text: dir.name,
        type: SearchQueryTypes.any_text,
        matchType: TextSearchQueryMatchTypes.exact_match
      } as TextSearch;
      expect(removeDir(await sm.search(query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, v],
        metaFile: [gpx],
        resultOverflow: false
      } as SearchResultDTO));
    });

  });


  it('should get random photo', async () => {
    const sm = new SearchManager();

    let query = {
      text: 'xyz',
      type: SearchQueryTypes.keyword
    } as TextSearch;

    // eslint-disable-next-line
    expect(await sm.getNMedia(query, [{method: SortByTypes.Random, ascending: null}], 1, true)).to.deep.equalInAnyOrder([]);

    query = ({
      text: 'wookiees',
      matchType: TextSearchQueryMatchTypes.exact_match,
      type: SearchQueryTypes.keyword
    } as TextSearch);
    expect(Utils.clone(await sm.getNMedia(query, [{
      method: SortByTypes.Random,
      ascending: null
    }], 1, true))).to.deep.equalInAnyOrder([searchifyMedia(pFaceLess)]);
  });

});
