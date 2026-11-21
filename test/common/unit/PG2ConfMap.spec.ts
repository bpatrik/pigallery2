import {expect} from 'chai';
import {PG2ConfMap} from '../../../src/common/PG2ConfMap';
import {
  DirectoryGroupByTypes,
  DirectorySortByTypes,
  GroupByTypes,
  SortByTypes
} from '../../../src/common/entities/SortingMethods';
import {Utils} from '../../../src/common/Utils';

// all media of a directory are in the same directory: sorting or grouping it by directory is meaningless
describe('PG2ConfMap', () => {

  it('should have no sorting by directory', () => {
    expect(Object.keys(PG2ConfMap.sorting)).to.include('.order_ascending_name.pg2conf');
    expect(Object.keys(PG2ConfMap.sorting)).to.include('.order_random.pg2conf');
    expect(Object.keys(PG2ConfMap.sorting).filter(f => f.includes('directory'))).to.deep.equal([]);
    expect(Object.values(PG2ConfMap.sorting).map(s => s.method)).to.not.include(SortByTypes.Directory);
  });

  it('should keep every other sorting and grouping for a directory', () => {
    const keys = (e: Record<string, string | number>): number[] => Utils.enumToArray(e).map(kv => kv.key);
    expect(keys(DirectorySortByTypes)).to.deep.equal(keys(SortByTypes).filter(k => k !== SortByTypes.Directory));
    expect(keys(DirectoryGroupByTypes)).to.deep.equal(keys(GroupByTypes).filter(k => k !== GroupByTypes.Directory));
    // the reverse mapping too, so it is a valid enum for the config and the settings
    expect(Utils.isValidEnumInt(DirectorySortByTypes, SortByTypes.Name)).to.equal(true);
    expect(Utils.isValidEnumInt(DirectorySortByTypes, SortByTypes.Directory)).to.equal(false);
  });
});
