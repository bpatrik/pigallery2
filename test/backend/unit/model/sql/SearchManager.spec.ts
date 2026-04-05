import {LocationManager} from '../../../../../src/backend/model/database/LocationManager';
import {SearchManager} from '../../../../../src/backend/model/database/SearchManager';
import {SearchResultDTO} from '../../../../../src/common/entities/SearchResultDTO';
import {Utils} from '../../../../../src/common/Utils';
import {DBTestHelper} from '../../../DBTestHelper';
import {
  ANDSearchQuery,
  DatePatternFrequency,
  DatePatternSearch, DateSearch,
  DistanceSearch,
  OrientationSearch,
  ORSearchQuery, PersonCountSearch, RatingSearch, ResolutionSearch,
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
import {SearchQueryParser} from '../../../../../src/common/SearchQueryParser';
import {FileDTO} from '../../../../../src/common/entities/FileDTO';
import {SortByTypes} from '../../../../../src/common/entities/SortingMethods';

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
    p2 = TestHelper.getPhotoEntry2(directory);
    p2.metadata.creationDate = Date.now() - 60 * 60 * 24 * 1000;
    p2.metadata.creationDateOffset = '+02:00';
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
    await ObjectManagers.getInstance().init();
  };


  before(async () => {
    await setUpSqlDB();
  });


  after(async () => {
    await sqlHelper.clearDB();
  });
  beforeEach(() => {
    Config.loadSync();
    Config.Search.listDirectories = true;
    Config.Search.listMetafiles = false;
  });

  it('should get autocomplete', async () => {
    const sm = new SearchManager();

    const cmp = (a: AutoCompleteItem, b: AutoCompleteItem) => {
      if (a.value === b.value) {
        return a.type - b.type;
      }
      return a.value.localeCompare(b.value);
    };

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
      beforeEach(()=>Config.loadSync());

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
     * flattenSameOfQueries  converts some-of queries to AND and OR queries
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


});
