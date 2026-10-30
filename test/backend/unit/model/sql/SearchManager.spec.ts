import {LocationManager} from '../../../../../src/backend/model/database/LocationManager';
import {SearchManager} from '../../../../../src/backend/model/database/SearchManager';
import {SearchResultDTO} from '../../../../../src/common/entities/SearchResultDTO';
import {Utils} from '../../../../../src/common/Utils';
import {DBTestHelper} from '../../../DBTestHelper';
import {
  ANDSearchQuery,
  DatePatternFrequency,
  DirectorySearch,
  DatePatternSearch,
  DateSearch,
  DistanceSearch,
  OrientationSearch,
  ORSearchQuery,
  PersonCountSearch,
  RatingSearch,
  ResolutionSearch,
  SearchListQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
} from '../../../../../src/common/entities/SearchQueryDTO';
import {DirectoryBaseDTO, ParentDirectoryDTO, SubDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {TestHelper} from '../../../../TestHelper';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {GPSMetadata, PhotoDTO, PhotoMetadata} from '../../../../../src/common/entities/PhotoDTO';
import {VideoDTO} from '../../../../../src/common/entities/VideoDTO';
import {AutoCompleteItem} from '../../../../../src/common/entities/AutoCompleteItem';
import {Config} from '../../../../../src/common/config/private/Config';
import {DatabaseType} from '../../../../../src/common/config/private/PrivateConfig';
import {SearchQueryParser} from '../../../../../src/common/SearchQueryParser';
import {FileDTO} from '../../../../../src/common/entities/FileDTO';
import {SortByTypes} from '../../../../../src/common/entities/SortingMethods';
import {SessionUser, SessionContext} from '../../../../../src/backend/model/SessionContext';
import {UserRoles} from '../../../../../src/common/entities/UserDTO';
import {UserEntity} from '../../../../../src/backend/model/database/enitites/UserEntity';
import {SharingEntity} from '../../../../../src/backend/model/database/enitites/SharingEntity';

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


class SearchManagerTest extends SearchManager {

  public flattenSameOfQueries(query: SearchQueryDTO): SearchQueryDTO {
    return super.flattenSameOfQueries(query);
  }

}


describe('SearchManager', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;
  /**
   * dir  <-- root: '.'
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
    p.metadata.creationDateOffset = '+02:00';
    p.metadata.keywords.push('question mark?');
    p.metadata.keywords.push('Jánoska'.normalize('NFD')); // decomposed: a + combining acute accent
    p2 = TestHelper.getPhotoEntry2(directory);
    p2.metadata.creationDate = Date.now() - 60 * 60 * 24 * 1000;
    p2.metadata.creationDateOffset = '+02:00';
    p2.metadata.keywords.push('underscore_');
    v = TestHelper.getVideoEntry1(directory);
    v.metadata.creationDate = Date.now() - 60 * 60 * 24 * 7 * 1000;
    v.metadata.creationDateOffset = '+02:00';
    gpx = TestHelper.getRandomizedGPXEntry(directory);
    p4 = TestHelper.getPhotoEntry4(subDir2);
    let d = new Date();
    //set creation date to one year and one day earlier
    p4.metadata.creationDate = d.getTime() - 60 * 60 * 24 * (Utils.isDateFromLeapYear(d) ? 367 : 366) * 1000;
    p4.metadata.creationDateOffset = '+02:00';
    const pFaceLessTmp = TestHelper.getPhotoEntry3(subDir);
    delete pFaceLessTmp.metadata.faces;
    d = new Date();
    //we create a date 1 month and 1 day before now
    d = Utils.addMonthToDate(d, -1); //subtract 1 month in the "human way"
    d.setDate(d.getDate() - 1); //subtract 1 day
    pFaceLessTmp.metadata.creationDate = d.getTime();
    pFaceLessTmp.metadata.creationDateOffset = '+02:00';

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
  };


  before(async () => {
    await setUpSqlDB();
  });


  after(sqlHelper.clearDB);
  beforeEach(() => {
    Config.loadSync();
    Config.Search.listDirectories = true;
    Config.Search.listMetafiles = false;
  });

  it('should get autocomplete', async () => {
    const sm = new SearchManager();


    expect((await sm.autocomplete(DBTestHelper.defaultSession, 'tat', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('Tatooine', SearchQueryTypes.position)]);
    expect((await sm.autocomplete(DBTestHelper.defaultSession, 'star', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('star wars', SearchQueryTypes.keyword),
      new AutoCompleteItem('death star', SearchQueryTypes.keyword)]);

    expect((await sm.autocomplete(DBTestHelper.defaultSession, 'wars', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('star wars', SearchQueryTypes.keyword)]);

    expect((await sm.autocomplete(DBTestHelper.defaultSession, 'phantom', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('phantom menace', SearchQueryTypes.keyword),
      new AutoCompleteItem('The Phantom Menace', SearchQueryTypes.directory)]);

    expect((await sm.autocomplete(DBTestHelper.defaultSession, 'arch', SearchQueryTypes.any_text))).eql([
      new AutoCompleteItem('Research City', SearchQueryTypes.position)]);

    Config.Search.AutoComplete.ItemsPerCategory.maxItems = 99999;
    expect((await sm.autocomplete(DBTestHelper.defaultSession, 'wa', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('star wars', SearchQueryTypes.keyword),
      new AutoCompleteItem('Anakin Skywalker', SearchQueryTypes.person),
      new AutoCompleteItem('Luke Skywalker', SearchQueryTypes.person)]);

    Config.Search.AutoComplete.ItemsPerCategory.maxItems = 1;
    expect((await sm.autocomplete(DBTestHelper.defaultSession, 'a', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('Anakin Skywalker', SearchQueryTypes.person),
      new AutoCompleteItem('Amber stone', SearchQueryTypes.caption),
      new AutoCompleteItem('Castilon', SearchQueryTypes.position),
      new AutoCompleteItem('star wars', SearchQueryTypes.keyword),
      new AutoCompleteItem('The Phantom Menace', SearchQueryTypes.directory)]);
    Config.Search.AutoComplete.ItemsPerCategory.maxItems = 5;
    Config.Search.AutoComplete.ItemsPerCategory.fileName = 5;
    Config.Search.AutoComplete.ItemsPerCategory.fileName = 5;

    expect((await sm.autocomplete(DBTestHelper.defaultSession, 'sw', SearchQueryTypes.any_text))).to.deep.equalInAnyOrder([
      new AutoCompleteItem('sw1.jpg', SearchQueryTypes.file_name),
      new AutoCompleteItem('sw2.jpg', SearchQueryTypes.file_name),
      new AutoCompleteItem('sw3.jpg', SearchQueryTypes.file_name),
      new AutoCompleteItem('sw4.jpg', SearchQueryTypes.file_name),
      new AutoCompleteItem(v.name, SearchQueryTypes.file_name)]);

    expect((await sm.autocomplete(DBTestHelper.defaultSession, v.name, SearchQueryTypes.any_text))).to.deep.equalInAnyOrder(
      [new AutoCompleteItem(v.name, SearchQueryTypes.file_name)]);

  });

  const searchifyMedia = <T extends FileDTO | PhotoDTO>(m: T): T => {
    const tmpDir: DirectoryBaseDTO = m.directory as DirectoryBaseDTO;
    const tmpM = tmpDir.media;
    const tmpD = tmpDir.directories;
    const tmpP = tmpDir.cache?.cover;
    const tmpMT = tmpDir.metaFile;
    delete tmpDir.directories;
    delete tmpDir.media;
    delete tmpDir.cache?.cover;
    delete tmpDir.cache?.valid;
    delete tmpDir.metaFile;
    const ret = Utils.clone(m);
    delete (ret.directory as DirectoryBaseDTO).lastScanned;
    delete (ret.directory as DirectoryBaseDTO).lastModified;
    delete (ret.directory as DirectoryBaseDTO).cache;
    if ((ret as PhotoDTO).metadata &&
      ((ret as PhotoDTO).metadata as PhotoMetadata).faces && !((ret as PhotoDTO).metadata as PhotoMetadata).faces.length) {
      delete ((ret as PhotoDTO).metadata as PhotoMetadata).faces;
    }
    tmpDir.directories = tmpD;
    tmpDir.media = tmpM;
    if (tmpDir.cache) {
      tmpDir.cache.cover = tmpP;
    }
    tmpDir.metaFile = tmpMT;
    return ret;
  };

  const searchifyDir = (d: DirectoryBaseDTO): DirectoryBaseDTO => {
    const tmpM = d.media;
    const tmpD = d.directories;
    const tmpP = d.cache.cover;
    const tmpMT = d.metaFile;
    delete d.directories;
    delete d.media;
    delete d.metaFile;
    const ret = Utils.clone(d);
    delete ret.cache?.id;
    d.directories = tmpD;
    d.media = tmpM;
    d.cache.cover = tmpP;
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

  describe('projectionQuery (session scoped filter)', () => {
    it('getCount should respect projectionQuery', async () => {
      const sm = new SearchManager();

      const projQ = ({
        value: 'wookiees',
        matchType: TextSearchQueryMatchTypes.exact_match,
        type: SearchQueryTypes.keyword
      } as TextSearch);
      const session = Utils.clone(DBTestHelper.defaultSession);
      session.projectionQuery = await sm.prepareAndBuildWhereQuery(projQ);

      const searchQ = {value: 'star wars', matchType: TextSearchQueryMatchTypes.exact_match, type: SearchQueryTypes.keyword} as TextSearch;

      // validate projection less count
      expect(await sm.getCount(DBTestHelper.defaultSession, projQ)).to.equal(1);
      expect(await sm.getCount(DBTestHelper.defaultSession, searchQ)).to.equal(4);

      // test
      expect(await sm.getCount(session, searchQ)).to.equal(1);

    });

    it('getNMedia should respect projectionQuery', async () => {
      const sm = new SearchManager();

      const projQ = ({
        value: 'wookiees',
        matchType: TextSearchQueryMatchTypes.exact_match,
        type: SearchQueryTypes.keyword
      } as TextSearch);
      const session = Utils.clone(DBTestHelper.defaultSession);
      session.projectionQuery = await sm.prepareAndBuildWhereQuery(projQ);

      const searchQ = {value: 'star wars', matchType: TextSearchQueryMatchTypes.exact_match, type: SearchQueryTypes.keyword} as TextSearch;

      const media = await sm.getNMedia(session, searchQ, [{
        method: SortByTypes.Random,
        ascending: null
      }], 10, true);

      expect(Utils.clone(media)).to.deep.equalInAnyOrder([searchifyMedia(pFaceLess)]);
    });


    describe('autocomplete', () => {
      beforeEach(() => Config.loadSync());

      it('autocomplete should respect projectionQuery', async () => {
        const sm = new SearchManager();

        const projQ = ({
          value: 'wookiees',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.keyword
        } as TextSearch);
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          overrideAllowBlockList: true,
          allowQuery: projQ
        } as any);

        // validate projection less count
        expect((await sm.autocomplete(DBTestHelper.defaultSession, 'phantom', SearchQueryTypes.any_text)).length).to.equal(2);

        // test
        expect((await sm.autocomplete(session, 'star', SearchQueryTypes.any_text)).length).to.equal(1);
        expect(await sm.autocomplete(session, 'star', SearchQueryTypes.any_text)).to.deep.equal([{
          value: 'star wars',
          type: SearchQueryTypes.keyword,
        }]);
      });

      it('autocomplete should apply directory projection to directory suggestions', async () => {
        const sm = new SearchManager();
        const projQ = ({
          value: 'The Phantom Menace',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.directory
        } as TextSearch);
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          overrideAllowBlockList: true,
          allowQuery: projQ
        } as any);

        // Without projection, searching 'Return' yields the directory suggestion
        expect(await sm.autocomplete(DBTestHelper.defaultSession, 'Return', SearchQueryTypes.directory))
          .to.deep.equalInAnyOrder([new AutoCompleteItem('Return of the Jedi', SearchQueryTypes.directory)]);

        // With projection to a different directory, expect no directory suggestion (should be filtered out)
        expect(await sm.autocomplete(session, 'Return', SearchQueryTypes.directory))
          .to.deep.equalInAnyOrder([]);

        expect(await sm.autocomplete(session, 'Phantom', SearchQueryTypes.directory))
          .to.deep.equalInAnyOrder([new AutoCompleteItem('The Phantom Menace', SearchQueryTypes.directory)]);
      });

      it('autocomplete should apply directory projection to keyword suggestions', async () => {
        const sm = new SearchManager();
        const projQ = ({
          value: 'The Phantom Menace',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.directory
        } as TextSearch);
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          overrideAllowBlockList: true,
          allowQuery: projQ
        } as any);

        // Without projection, searching 'Return' yields the directory suggestion
        expect(await sm.autocomplete(DBTestHelper.defaultSession, 'Natalie', SearchQueryTypes.keyword))
          .to.deep.equalInAnyOrder([new AutoCompleteItem('Natalie Portman', SearchQueryTypes.keyword)]);

        // With projection to a different directory, expect no directory suggestion (should be filtered out)
        expect(await sm.autocomplete(session, 'Natalie', SearchQueryTypes.keyword))
          .to.deep.equalInAnyOrder([]);
      });


      it('autocomplete should apply keyword projection to file_name suggestions', async () => {
        const sm = new SearchManager();
        // Project to photos with keyword "wookiees" which earlier narrowed results to pFaceLess
        const projQ = ({
          value: 'wookiees',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.keyword
        } as TextSearch);
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          overrideAllowBlockList: true,
          allowQuery: projQ
        } as any);

        // Without projection, many sw*.jpg are returned for 'sw'
        const noProj = await sm.autocomplete(DBTestHelper.defaultSession, 'sw', SearchQueryTypes.file_name);
        expect(noProj.length).to.be.greaterThan(1);

        // With projection, expect only the single media file name from the projected set
        const withProj = await sm.autocomplete(session, 'sw', SearchQueryTypes.file_name);
        expect(withProj).to.deep.equalInAnyOrder([
          new AutoCompleteItem(pFaceLess.name, SearchQueryTypes.file_name)
        ]);
      });

      it('autocomplete should apply projection to person suggestions', async () => {
        const sm = new SearchManager();

        // Project to photos with "Boba Fett" person, which should include only p (sw1.jpg)
        // p contains: Boba Fett, Luke Skywalker, Han Solo, Unkle Ben, R2-D2
        const projQ = ({
          value: 'Boba Fett',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.person
        } as TextSearch);
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          overrideAllowBlockList: true,
          allowQuery: projQ
        } as any);

        // Without projection, searching 'a' should return multiple people
        const noProj = await sm.autocomplete(DBTestHelper.defaultSession, 'a', SearchQueryTypes.person);
        expect(noProj.length).to.be.greaterThan(2); // Should include Anakin Skywalker from p2 and p4

        // With projection to Boba Fett photos, expect only people from that photo set
        // 'a' should match Han Solo (from p/sw1.jpg) but not Anakin Skywalker (from p2/p4)
        Config.Search.AutoComplete.ItemsPerCategory.person = 999;
        Config.Search.AutoComplete.ItemsPerCategory.maxItems = 999;
        const withProj = await sm.autocomplete(session, 'a', SearchQueryTypes.person);
        expect(withProj).to.deep.equalInAnyOrder([
          new AutoCompleteItem('Boba Fett', SearchQueryTypes.person),
          new AutoCompleteItem('Anakin Skywalker', SearchQueryTypes.person),
          new AutoCompleteItem('Luke Skywalker', SearchQueryTypes.person),
          new AutoCompleteItem('Han Solo', SearchQueryTypes.person)
        ]);
      });

      it('autocomplete should filter out persons with count=0 when projection is applied', async () => {
        const sm = new SearchManager();

        // Project to photos with keyword "wookiees" which only matches pFaceLess (sw3.jpg)
        // but pFaceLess has no faces, so all persons should have count=0
        const projQ = ({
          value: 'wookiees',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.keyword
        } as TextSearch);
        const session = await ObjectManagers.getInstance().SessionManager.buildContext({
          overrideAllowBlockList: true,
          allowQuery: projQ
        } as any);

        // Without projection, should return people matching the search term
        const noProj = await sm.autocomplete(DBTestHelper.defaultSession, 'skywalker', SearchQueryTypes.person);
        expect(noProj.length).to.be.equal(2); // Should find Luke and Anakin Skywalker

        // With projection to photos with no faces, expect no person suggestions (all have count=0)
        const withProj = await sm.autocomplete(session, 'skywalker', SearchQueryTypes.person);
        expect(withProj).to.deep.equalInAnyOrder([]);

        // Test with a broader search term
        const withProjBroad = await sm.autocomplete(session, 'a', SearchQueryTypes.person);
        expect(withProjBroad).to.deep.equalInAnyOrder([]);
      });
    });
    it('search should respect projectionQuery', async () => {
      const sm = new SearchManager();

      const projQ = ({
        value: 'wookiees',
        matchType: TextSearchQueryMatchTypes.exact_match,
        type: SearchQueryTypes.keyword
      } as TextSearch);
      const session = Utils.clone(DBTestHelper.defaultSession);
      session.projectionQuery = await sm.prepareAndBuildWhereQuery(projQ);

      const searchQ = {value: 'star wars', matchType: TextSearchQueryMatchTypes.exact_match, type: SearchQueryTypes.keyword} as TextSearch;

      Config.Search.listDirectories = false;
      Config.Search.listMetafiles = false;

      const result = await sm.search(session, searchQ);
      expect(removeDir(result)).to.deep.equalInAnyOrder(removeDir({
        searchQuery: searchQ,
        directories: [],
        media: [pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
    });
  });

  describe('advanced search', () => {
    beforeEach(async () => {
      Config.loadSync();
      Config.Search.listDirectories = false;
      Config.Search.listMetafiles = false;
    });

    it('should AND', async () => {
      const sm = new SearchManager();

      let query: SearchQueryDTO = {
        type: SearchQueryTypes.AND,
        list: [{value: p.metadata.faces[0].name, type: SearchQueryTypes.person} as TextSearch,
          {value: p2.metadata.caption, type: SearchQueryTypes.caption} as TextSearch]
      } as ANDSearchQuery;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
      query = ({
        type: SearchQueryTypes.AND,
        list: [{value: p.metadata.faces[0].name, type: SearchQueryTypes.person} as TextSearch,
          {value: p.metadata.caption, type: SearchQueryTypes.caption} as TextSearch]
      } as ANDSearchQuery);
      expect(await sm.search(DBTestHelper.defaultSession, query)).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      // make sure that this shows both photos. We need this the the rest of the tests
      query = ({value: 'a', type: SearchQueryTypes.person} as TextSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
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
          list: [{value: 'a', type: SearchQueryTypes.person} as TextSearch,
            {value: p.metadata.keywords[0], type: SearchQueryTypes.keyword} as TextSearch]
        } as ANDSearchQuery,
          {value: p.metadata.caption, type: SearchQueryTypes.caption} as TextSearch
        ]
      } as ANDSearchQuery);

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
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
        list: [{value: 'Not a person', type: SearchQueryTypes.person} as TextSearch,
          {value: 'Not a caption', type: SearchQueryTypes.caption} as TextSearch]
      } as ORSearchQuery;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
      query = ({
        type: SearchQueryTypes.OR,
        list: [{value: p.metadata.faces[0].name, type: SearchQueryTypes.person} as TextSearch,
          {value: p2.metadata.caption, type: SearchQueryTypes.caption} as TextSearch]
      } as ORSearchQuery);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        type: SearchQueryTypes.OR,
        list: [{value: p.metadata.faces[0].name, type: SearchQueryTypes.person} as TextSearch,
          {value: p.metadata.caption, type: SearchQueryTypes.caption} as TextSearch]
      } as ORSearchQuery);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      // make sure that this shows both photos. We need this the the rest of the tests
      query = ({value: 'a', type: SearchQueryTypes.person} as TextSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
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
          list: [{value: 'a', type: SearchQueryTypes.person} as TextSearch,
            {value: p.metadata.keywords[0], type: SearchQueryTypes.keyword} as TextSearch]
        } as ORSearchQuery,
          {value: p.metadata.caption, type: SearchQueryTypes.caption} as TextSearch
        ]
      } as ORSearchQuery);

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
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
          list: [{value: p.metadata.keywords[0], type: SearchQueryTypes.keyword} as TextSearch,
            {value: p2.metadata.keywords[0], type: SearchQueryTypes.keyword} as TextSearch]
        } as ORSearchQuery,
          {value: pFaceLess.metadata.caption, type: SearchQueryTypes.caption} as TextSearch
        ]
      } as ORSearchQuery);

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
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
        list: [{value: 'jpg', type: SearchQueryTypes.file_name} as TextSearch,
          {value: 'mp4', type: SearchQueryTypes.file_name} as TextSearch]
      } as SomeOfSearchQuery;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess, p4, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        type: SearchQueryTypes.SOME_OF,
        list: [{value: 'R2', type: SearchQueryTypes.person} as TextSearch,
          {value: 'Anakin', type: SearchQueryTypes.person} as TextSearch,
          {value: 'Luke', type: SearchQueryTypes.person} as TextSearch,
          {value: 'Non-Existing', type: SearchQueryTypes.person} as TextSearch]
      } as SomeOfSearchQuery);

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


      query.min = 2;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query.min = 3;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query.min = 4;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        type: SearchQueryTypes.SOME_OF,
        min: 3,
        list: [{value: 'sw', type: SearchQueryTypes.file_name} as TextSearch,
          {value: 'R2', type: SearchQueryTypes.person} as TextSearch,
          {value: 'Kamino', type: SearchQueryTypes.position} as TextSearch,
          {value: 'Han', type: SearchQueryTypes.person} as TextSearch]
      } as SomeOfSearchQuery);

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });

    it('should search date', async () => {
      const sm = new SearchManager();

      let query: DateSearch = {max: 0, type: SearchQueryTypes.date} as DateSearch;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        min: p2.metadata.creationDate, type: SearchQueryTypes.date
      } as DateSearch);

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        min: p.metadata.creationDate,
        negate: true,
        type: SearchQueryTypes.date
      } as DateSearch);

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p2, pFaceLess, p4, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({
        max: p.metadata.creationDate + 1000000000,
        type: SearchQueryTypes.date
      } as DateSearch);

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess, v, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });

    it('should search rating', async () => {
      const sm = new SearchManager();

      let query: RatingSearch = {max: 0, type: SearchQueryTypes.rating} as RatingSearch;


      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({max: 5, type: SearchQueryTypes.rating} as RatingSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({max: 5, negate: true, type: SearchQueryTypes.rating} as RatingSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({min: 2, type: SearchQueryTypes.rating} as RatingSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p2, pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({min: 2, negate: true, type: SearchQueryTypes.rating} as RatingSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

      let query: PersonCountSearch = {max: 0, type: SearchQueryTypes.person_count} as PersonCountSearch;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [pFaceLess, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({max: 20, type: SearchQueryTypes.person_count} as PersonCountSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess, p4, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({max: 20, negate: true, type: SearchQueryTypes.person_count} as PersonCountSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


      query = ({max: 4, type: SearchQueryTypes.person_count} as PersonCountSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p2, p4, pFaceLess, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({min: 2, type: SearchQueryTypes.person_count} as PersonCountSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({min: 5, type: SearchQueryTypes.person_count} as PersonCountSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({min: 2, negate: true, type: SearchQueryTypes.person_count} as PersonCountSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

      let query: ResolutionSearch =
        {max: 0, type: SearchQueryTypes.resolution} as ResolutionSearch;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({max: 1, type: SearchQueryTypes.resolution} as ResolutionSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({min: 3, type: SearchQueryTypes.resolution} as ResolutionSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


      query = ({min: 3, negate: true, type: SearchQueryTypes.resolution} as ResolutionSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, pFaceLess, v],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

      query = ({max: 3, negate: true, type: SearchQueryTypes.resolution} as ResolutionSearch);
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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
      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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
        from: {value: 'Tatooine'},
        distance: 1,
        type: SearchQueryTypes.distance
      } as DistanceSearch;

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

      expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, pFaceLess, p4],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));

    });

    /**
     * flattenSameOfQueries converts some-of queries to AND and OR queries
     * E.g.:
     * 2-of:(A B C) to (A and (B or C)) or (B and C)
     * this tests makes sure that all queries has at least 2 constraints
     */
    (it('should flatter SOME_OF query', () => {
      const sm = new SearchManagerTest();
      const parser = new SearchQueryParser();
      const alphabet = 'abcdefghijklmnopqrs';


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
            value: t
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
          value: t
        } as TextSearch))
      };
      expect(removeDir(await sm.search(DBTestHelper.defaultSession, query)))
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
      cloned.cache.valid = true;
      cloned.cache.cover = {
        directory: {
          name: subDir.name,
          path: subDir.path
        },
        name: pFaceLess.name
      } as any;
      const query = {
        value: subDir.name,
        type: SearchQueryTypes.any_text
      } as TextSearch;
      expect(removeDir(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [cloned],
        media: [pFaceLess],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
    });


    it('search result should not return recursively empty directory', async () => {
      Config.Search.listDirectories = true;
      const sm = new SearchManager();
      const session = await ObjectManagers.getInstance().SessionManager.buildContext({
        allowQuery: {value: 'YOU WONT FIND IT', type: SearchQueryTypes.keyword} as TextSearch,
        overrideAllowBlockList: true
      } as any);

      let query = {
        value: subDir.name,
        type: SearchQueryTypes.any_text
      } as TextSearch;
      expect(removeDir(await sm.search(session, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));


      query = {
        value: dir.name,
        type: SearchQueryTypes.any_text
      } as TextSearch;
      expect(removeDir(await sm.search(session, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO));
    });

    it('search result should return meta files', async () => {
      Config.Search.listMetafiles = true;
      const sm = new SearchManager();

      const query = {
        value: dir.name,
        type: SearchQueryTypes.any_text,
        matchType: TextSearchQueryMatchTypes.exact_match
      } as TextSearch;
      expect(removeDir(await sm.search(DBTestHelper.defaultSession, query)))
        .to.deep.equalInAnyOrder(removeDir({
        searchQuery: query,
        directories: [],
        media: [p, p2, v],
        metaFile: [gpx],
        resultOverflow: false
      } as SearchResultDTO));
    });

    describe('should search text', () => {
      it('as any', async () => {
        const sm = new SearchManager();

        let query = {value: 'sw', type: SearchQueryTypes.any_text} as TextSearch;
        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, {value: 'sw', type: SearchQueryTypes.any_text} as TextSearch)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, v, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({value: 'sw', negate: true, type: SearchQueryTypes.any_text} as TextSearch);

        expect(removeDir(await sm.search(DBTestHelper.defaultSession, query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({value: 'Boba', type: SearchQueryTypes.any_text} as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({value: 'Boba', negate: true, type: SearchQueryTypes.any_text} as TextSearch);
        expect(removeDir(await sm.search(DBTestHelper.defaultSession, query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p2, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({value: 'Boba', negate: true, type: SearchQueryTypes.any_text} as TextSearch);
        // all should have faces
        const sRet = await sm.search(DBTestHelper.defaultSession, query);
        for (const item of sRet.media) {
          if (item.id === pFaceLess.id) {
            continue;
          }

          expect((item as PhotoDTO).metadata.faces).to.be.not.an('undefined');
          expect((item as PhotoDTO).metadata.faces).to.be.lengthOf.above(1);
        }


        query = ({
          value: 'Boba',
          type: SearchQueryTypes.any_text,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch);
        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({
          value: 'Boba Fett',
          type: SearchQueryTypes.any_text,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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


        const query = {value: 'Tatooine', type: SearchQueryTypes.position} as TextSearch;
        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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
          value: 'kie',
          type: SearchQueryTypes.keyword
        } as TextSearch;
        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p2, pFaceLess],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          value: 'wa',
          type: SearchQueryTypes.keyword
        } as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          value: 'han s',
          type: SearchQueryTypes.keyword
        } as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          value: 'star wars',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.keyword
        } as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          value: 'wookiees',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.keyword
        } as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [pFaceLess],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

      });


      it('as keyword, ignoring case and accents (#729)', async () => {
        const sm = new SearchManager();
        const search = async (value: string, matchType = TextSearchQueryMatchTypes.like) =>
          (await sm.search(DBTestHelper.defaultSession, {
            value,
            matchType,
            type: SearchQueryTypes.keyword
          } as TextSearch)).media.map(m => m.name);

        // 'Padmé Amidala' is stored precomposed, 'Jánoska' decomposed (NFD)
        expect(await search('padme')).to.deep.equal([p2.name]);
        expect(await search('PADMÉ')).to.deep.equal([p2.name]);
        if (Config.Database.type === DatabaseType.sqlite) {
          // MySQL's general_ci does not fold decomposed accents: only SQLiteLike does
          expect(await search('janos')).to.deep.equal([p.name]);
          expect(await search('János')).to.deep.equal([p.name]);
          expect(await search('JÁNOS'.normalize('NFD'))).to.deep.equal([p.name]);
        }
        // exact matches keep SQLite's native LIKE (accent-sensitive), MySQL's collation folds them
        expect(await search('padmé amidala', TextSearchQueryMatchTypes.exact_match)).to.deep.equal([p2.name]);
        expect(await search('padme amidala', TextSearchQueryMatchTypes.exact_match))
          .to.deep.equal(Config.Database.type === DatabaseType.sqlite ? [] : [p2.name]);
      });


      it('as caption', async () => {
        const sm = new SearchManager();


        const query = {
          value: 'han',
          type: SearchQueryTypes.caption
        } as TextSearch;

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
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
          value: 'sw',
          type: SearchQueryTypes.file_name
        } as TextSearch;


        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, v, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          value: 'sw4',
          type: SearchQueryTypes.file_name
        } as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, {
          value: 'sw4',
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
          value: 'of the J',
          type: SearchQueryTypes.directory
        } as TextSearch;

        expect(removeDir(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({
          value: '.',
          type: SearchQueryTypes.directory
        } as TextSearch);

        expect(removeDir(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, v, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({
          value: '.',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.directory
        } as TextSearch);


        expect(removeDir(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, v],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));


        query = ({
          value: '/Return of the Jedi',
          //    matchType: TextSearchQueryMatchTypes.like,
          type: SearchQueryTypes.directory
        } as TextSearch);

        expect(removeDir(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), JSON.stringify(query));

        query = ({
          value: '/Return of the Jedi',
          matchType: TextSearchQueryMatchTypes.exact_match,
          type: SearchQueryTypes.directory
        } as TextSearch);

        expect(removeDir(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
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
          value: 'Boba',
          type: SearchQueryTypes.person
        } as TextSearch;

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          value: 'Boba',
          type: SearchQueryTypes.person,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        query = ({
          value: 'Boba Fett',
          type: SearchQueryTypes.person,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch);

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, {
          value: 'Boba Fett',
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

      it('with globMatch', async () => {
        const sm = new SearchManager();

        // Test 1: Match filenames starting with sw
        let query = {
          value: 'sw*',
          type: SearchQueryTypes.file_name,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;


        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, v, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), (new SearchQueryParser()).stringify(query));

        //  Match wildcard with keyword
        query = {
          value: '*\\?',
          type: SearchQueryTypes.keyword,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;


        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), (new SearchQueryParser()).stringify(query));


        //  Match underscore (sql wildcard) with keyword
        query = {
          value: '*_',
          type: SearchQueryTypes.keyword,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;


        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p2],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), (new SearchQueryParser()).stringify(query));

        // Test 2: Match filenames ending with .jpg
        query = {
          value: '*.jpg',
          type: SearchQueryTypes.file_name,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), (new SearchQueryParser()).stringify(query));

        // Test 3: Match Mos Eis* city under position
        query = {
          value: 'Mos Eis*',
          type: SearchQueryTypes.position,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), (new SearchQueryParser()).stringify(query));

        // Test 4: Negated glob match (no jpg)
        query = {
          value: '*.jpg',
          type: SearchQueryTypes.file_name,
          negate: true,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [v],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO), (new SearchQueryParser()).stringify(query));

        // Test 5: Exact match using glob (no wildcards)
        query = {
          value: 'sw1.jpg',
          type: SearchQueryTypes.file_name,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        // Test 6: Wildcard ? (single character)
        query = {
          value: 'sw?.jpg',
          type: SearchQueryTypes.file_name,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [p, p2, pFaceLess, p4],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));

        // Test 7: Escaped wildcard (should not act as wildcard)
        query = {
          value: 'sw\\*.jpg',
          type: SearchQueryTypes.file_name,
          matchType: TextSearchQueryMatchTypes.globMatch
        } as TextSearch;

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query))).to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));
      });

    });

    describe('search date pattern', () => {
      let p5: PhotoDTO;
      let p6: PhotoDTO;
      let p7: PhotoDTO;
      let sm: SearchManager;

      before(async () => {
        Config.loadSync();
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
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

        expect(Utils.clone(await sm.search(DBTestHelper.defaultSession, query)))
          .to.deep.equalInAnyOrder(removeDir({
          searchQuery: query,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        } as SearchResultDTO));


      });
    });
  });

  it('should get random photo', async () => {
    const sm = new SearchManager();

    let query = {
      value: 'xyz',
      type: SearchQueryTypes.keyword
    } as TextSearch;

    // eslint-disable-next-line
    expect(await sm.getNMedia(DBTestHelper.defaultSession, query, [{
      method: SortByTypes.Random,
      ascending: null
    }], 1, true)).to.deep.equalInAnyOrder([]);

    query = ({
      value: 'wookiees',
      matchType: TextSearchQueryMatchTypes.exact_match,
      type: SearchQueryTypes.keyword
    } as TextSearch);
    expect(Utils.clone(await sm.getNMedia(DBTestHelper.defaultSession, query, [{
      method: SortByTypes.Random,
      ascending: null
    }], 1, true))).to.deep.equalInAnyOrder([searchifyMedia(pFaceLess)]);
  });

  it('prepareAndBuildWhereQuery should not fail on directory only', async () => {
    const sm = new SearchManager();
    const query = {
      type: SearchQueryTypes.AND,
      list: [
        {
          matchType: TextSearchQueryMatchTypes.like,
          negate: true,
          type: SearchQueryTypes.keyword,
          value: 'Urbex'
        },
        {
          matchType: TextSearchQueryMatchTypes.like,
          type: SearchQueryTypes.directory,
          value: 'KRIKš'
        } as TextSearch
      ]
    } as ANDSearchQuery;

    // This should not throw TypeError: Cannot read properties of null (reading 'queryId')
    await sm.prepareAndBuildWhereQuery(query, true, {directory: 'directories'});
  });



  describe('Directory allow/block list', () => {
    const dq = (value: string, matchType = TextSearchQueryMatchTypes.exact_match, negate = false): DirectorySearch =>
      ({type: SearchQueryTypes.directory, value, matchType, negate});
    const glob = (value: string): DirectorySearch => dq(value, TextSearchQueryMatchTypes.globMatch);
    const dirSearch = (value: string): TextSearch =>
      ({type: SearchQueryTypes.directory, value, matchType: TextSearchQueryMatchTypes.like});
    const fileName = (value: string): TextSearch =>
      ({type: SearchQueryTypes.file_name, value, matchType: TextSearchQueryMatchTypes.like});
    const anyPhoto = fileName('Photo');

    const buildSession = (u: Partial<SessionUser>): Promise<SessionContext> =>
      ObjectManagers.getInstance().SessionManager.buildContext({
        id: 1,
        name: 'user',
        role: UserRoles.User,
        overrideAllowBlockList: true,
        ...u
      } as SessionUser);

    const sharingSession = (s: Partial<SharingEntity>): Promise<SessionContext> => {
      const sm = ObjectManagers.getInstance().SessionManager;
      return sm.buildContext(sm.createSharingUser({
        sharingKey: 'key',
        creator: {id: 1, name: 'creator', role: UserRoles.Admin} as UserEntity,
        ...s
      } as unknown as SharingEntity));
    };

    const searchMediaNames = async (session: SessionContext, q: SearchQueryDTO) =>
      (await ObjectManagers.getInstance().SearchManager.search(session, q)).media.map(m => m.name.split('_')[0]).sort();
    const searchDirNames = async (session: SessionContext, q: SearchQueryDTO) =>
      (await ObjectManagers.getInstance().SearchManager.search(session, q)).directories.map(d => d.name).sort();

    before(async () => {
      await sqlHelper.initDB();
      await sqlHelper.setUpNestedTestGallery();
    });

    after(async () => {
      // restore the default gallery of this spec
      await setUpSqlDB();
    });

    it('trailing /* in a directory search matches the directory and everything below', async () => {
      expect(await searchMediaNames(DBTestHelper.defaultSession, glob('private/*'))).to.deep.equal(['deepPhoto', 'privatePhoto']);
      expect(await searchMediaNames(DBTestHelper.defaultSession, glob('private/?*'))).to.deep.equal(['deepPhoto']);
      expect(await searchMediaNames(DBTestHelper.defaultSession, dq('private/*', TextSearchQueryMatchTypes.globMatch, true)))
        .to.deep.equal(['otherPhoto', 'publicPhoto', 'rootPhoto', 'subPhoto']);
    });

    it('filters media of blocked directories', async () => {
      const s = await buildSession({blockDirectoryList: [dq('private')]});
      expect(await searchMediaNames(s, anyPhoto)).to.deep.equal(['deepPhoto', 'otherPhoto', 'publicPhoto', 'rootPhoto', 'subPhoto']);
      const sRec = await buildSession({blockDirectoryList: [glob('private/*')]});
      expect(await searchMediaNames(sRec, anyPhoto)).to.deep.equal(['otherPhoto', 'publicPhoto', 'rootPhoto', 'subPhoto']);
    });

    it('filters media to allowed directories', async () => {
      const s = await buildSession({allowDirectoryList: [glob('public/*')]});
      expect(await searchMediaNames(s, anyPhoto)).to.deep.equal(['publicPhoto', 'subPhoto']);
    });

    it('filters directories in search results', async () => {
      const s = await buildSession({blockDirectoryList: [glob('private/*')]});
      expect(await searchDirNames(s, dirSearch('deep'))).to.deep.equal([]);
      expect(await searchDirNames(DBTestHelper.defaultSession, dirSearch('deep'))).to.deep.equal(['deep']);
      // parents of allowed directories are not listed
      const sAllow = await buildSession({allowDirectoryList: [dq('public/sub')]});
      expect(await searchDirNames(sAllow, dirSearch('u'))).to.deep.equal(['sub']);
    });

    it('filters directories in autocomplete', async () => {
      const s = await buildSession({blockDirectoryList: [glob('private/*')]});
      const ac = await ObjectManagers.getInstance().SearchManager.autocomplete(s, 'p', SearchQueryTypes.directory);
      expect(ac.map(a => a.value)).to.deep.equal(['public']);
    });

    it('sharing directory query limits the directories and the media', async () => {
      const s = await sharingSession({directoryQuery: glob('public/*')});
      expect(await searchMediaNames(s, anyPhoto)).to.deep.equal(['publicPhoto', 'subPhoto']);
      expect(await searchDirNames(s, dirSearch('u'))).to.deep.equal(['public', 'sub']);
    });

    it('search sharing lists only directories with visible photos', async () => {
      const s = await sharingSession({searchQuery: fileName('subPhoto')});
      expect(await searchMediaNames(s, anyPhoto)).to.deep.equal(['subPhoto']);
      // public only has photos below it
      expect(await searchDirNames(s, dirSearch('u'))).to.deep.equal(['sub']);
      const ac = await ObjectManagers.getInstance().SearchManager.autocomplete(s, 'u', SearchQueryTypes.directory);
      expect(ac.map(a => a.value)).to.deep.equal(['sub']);
    });

    // keep it last: it adds a directory to the test gallery
    it('treats SQL wildcards (_ and %) in directory searches as literal characters', async () => {
      const underscore = TestHelper.getDirectoryEntry(TestHelper.getDirectoryEntry(null, '.'), 'under_score');
      TestHelper.getRandomizedPhotoEntry(underscore, 'underscorePhoto');
      await ObjectManagers.getInstance().IndexingManager.saveToDB(underscore as ParentDirectoryDTO);

      expect(await searchMediaNames(DBTestHelper.defaultSession, dq('under_score'))).to.deep.equal(['underscorePhoto']);
      const s = await sharingSession({directoryQuery: dq('under_score')});
      expect(await searchMediaNames(s, anyPhoto)).to.deep.equal(['underscorePhoto']);
      // '_' and '%' would match any characters if they were not escaped
      expect(await searchMediaNames(DBTestHelper.defaultSession, dq('publi_'))).to.deep.equal([]);
      expect(await searchMediaNames(DBTestHelper.defaultSession, dq('pub%'))).to.deep.equal([]);
    });
  });
});
