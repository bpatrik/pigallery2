import {SearchManager} from '../../../../../src/backend/model/database/SearchManager';
import {DBTestHelper} from '../../../DBTestHelper';
import {SearchQueryTypes} from '../../../../../src/common/entities/SearchQueryDTO';
import {ParentDirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {AutoCompleteItem} from '../../../../../src/common/entities/AutoCompleteItem';
import {Config} from '../../../../../src/common/config/private/Config';
import {TestHelper} from '../../../../TestHelper';

const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chai = require('chai');
chai.use(deepEqualInAnyOrder);
const {expect} = chai;

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
declare const before: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe(); // fake it os IDE plays nicely (recognize the test)

describe('SearchManager autocomplete limits', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  const addPhoto = (dir: ParentDirectoryDTO, name: string, keywords: string[],
                    position: { city: string, state: string, country: string }): void => {
    const p = TestHelper.getPhotoEntry(dir);
    p.name = name;
    p.metadata.keywords = keywords;
    p.metadata.positionData!.city = position.city;
    p.metadata.positionData!.state = position.state;
    p.metadata.positionData!.country = position.country;
  };

  const autocomplete = (value: string, type: SearchQueryTypes): Promise<AutoCompleteItem[]> =>
    new SearchManager().autocomplete(DBTestHelper.defaultSession, value, type);

  before(async () => {
    await sqlHelper.initDB();
    const dir = TestHelper.getDirectoryEntry();
    const states = ['Illinois', 'Ohio', 'Oregon', 'Missouri', 'Massachusetts', 'Vermont'];
    // more keyword lists and position rows that match than the limit, all with the same suggestion
    states.forEach((state, i) => addPhoto(dir, `2016-${i}.jpg`,
      ['Family ' + i, 'Ski Trip 2016', 'Snow ' + i],
      {city: 'Springfield', state, country: 'United States'}));
    // the only lists holding the other suggestions: one together with an already found one
    addPhoto(dir, '2020.jpg', ['Ski Trip 2016', 'Ski Trip 2020'],
      {city: 'Springfield', state: 'Kentucky', country: 'United States'});
    addPhoto(dir, '2024.jpg', ['Ski Trip 2024'],
      {city: 'Springville', state: 'Utah', country: 'United States'});
    // the same name as a city and as a state
    addPhoto(dir, 'cordoba.jpg', ['Cordoba'], {city: 'Córdoba', state: 'Córdoba', country: 'Argentina'});
    await DBTestHelper.persistTestDir(dir);
  });

  after(async () => {
    await sqlHelper.clearDB();
  });

  beforeEach(() => {
    sqlHelper.resetConfig();
  });

  const items = (type: SearchQueryTypes, ...texts: string[]): AutoCompleteItem[] =>
    texts.map((t) => new AutoCompleteItem(t, type));

  it('should find every matching keyword, not just those of the first keyword lists', async () => {
    Config.Search.AutoComplete.ItemsPerCategory.keyword = 5;
    expect(await autocomplete('ski trip', SearchQueryTypes.keyword)).to.deep.equalInAnyOrder(
      items(SearchQueryTypes.keyword, 'Ski Trip 2016', 'Ski Trip 2020', 'Ski Trip 2024'));
  });

  it('should fill the keyword limit with distinct keywords', async () => {
    Config.Search.AutoComplete.ItemsPerCategory.keyword = 2;
    const result = await autocomplete('ski trip', SearchQueryTypes.keyword);
    expect(result).to.have.length(2);
    expect(new Set(result.map((r) => r.value)).size).to.equal(2);
  });

  it('should find every matching position, not just those of the first rows', async () => {
    Config.Search.AutoComplete.ItemsPerCategory.position = 5;
    expect(await autocomplete('spring', SearchQueryTypes.position)).to.deep.equalInAnyOrder(
      items(SearchQueryTypes.position, 'Springfield', 'Springville'));
  });

  it('should suggest a name that is a city and a state once', async () => {
    Config.Search.AutoComplete.ItemsPerCategory.position = 5;
    expect(await autocomplete('rdoba', SearchQueryTypes.position)).to.deep.equalInAnyOrder(
      items(SearchQueryTypes.position, 'Córdoba'));
  });

  it('should fill the position limit across columns', async () => {
    Config.Search.AutoComplete.ItemsPerCategory.position = 3;
    expect(await autocomplete('o', SearchQueryTypes.position)).to.have.length(3);
  });
});
