import {expect} from 'chai';
import {Utils} from '../../../src/common/Utils';

describe('Utils', () => {
  it('should concat urls', () => {
    expect(Utils.concatUrls('\\')).to.be.equal('.');
    expect(Utils.concatUrls('\\*')).to.be.equal('/*');
    expect(Utils.concatUrls('abc', 'cde')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('abc/', 'cde')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('abc\\', 'cde')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('abc/', 'cde/')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('./abc\\', 'cde/')).to.be.equal('./abc/cde');
    expect(Utils.concatUrls('/abc\\', 'cde/')).to.be.equal('/abc/cde');
    expect(Utils.concatUrls('abc/', '\\cde/')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('/abc/', '\\cde/')).to.be.equal('/abc/cde');
    expect(Utils.concatUrls('abc\\', '\\cde/')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('abc\\', '/cde/')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('abc/', '/cde/')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('abc\\/', '/cde/')).to.be.equal('abc/cde');
    expect(Utils.concatUrls('abc\\/', '/cde/', 'fgh')).to.be.equal('abc/cde/fgh');
    expect(Utils.concatUrls('abc\\/', '////cde/', 'fgh')).to.be.equal('abc/cde/fgh');
    expect(Utils.concatUrls('http://abc\\/', '/cde/', 'fgh')).to.be.equal('http://abc/cde/fgh');
    expect(Utils.concatUrls('https://abc\\/', '/cde/', 'fgh')).to.be.equal('https://abc/cde/fgh');
  });

  it('should find closest number', () => {

    expect(Utils.findClosest(10, [10, 13, 4, 20])).to.be.equal(10);
    expect(Utils.findClosest(10, [13, 4, 20])).to.be.equal(13);
    expect(Utils.findClosest(10, [4, 20])).to.be.equal(4);
    expect(Utils.findClosest(10, [20])).to.be.equal(20);
  });
  it('should find closest number in sorted array', () => {

    expect(Utils.findClosestinSorted(10, [3, 5, 8, 10, 15, 20])).to.be.equal(10);
    expect(Utils.findClosestinSorted(10, [3, 5, 8, 15, 20])).to.be.equal(8);
    expect(Utils.findClosestinSorted(10, [3, 5, 15, 20])).to.be.equal(15);
    expect(Utils.findClosestinSorted(10, [3, 5, 20])).to.be.equal(5);
    expect(Utils.findClosestinSorted(10, [3, 20])).to.be.equal(3);
    expect(Utils.findClosestinSorted(10, [20])).to.be.equal(20);
  });
  it('should equal', () => {

    expect(Utils.equalsFilter('abc', 'abc')).to.be.equal(true);
    expect(Utils.equalsFilter('abc', 'abcd')).to.be.equal(false);
    expect(Utils.equalsFilter(10, 10)).to.be.equal(true);
    expect(Utils.equalsFilter(10, 11)).to.be.equal(false);
    expect(Utils.equalsFilter(true, true)).to.be.equal(true);
    expect(Utils.equalsFilter(false, false)).to.be.equal(true);
    expect(Utils.equalsFilter(false, true)).to.be.equal(false);
    expect(Utils.equalsFilter(true, false)).to.be.equal(false);
    expect(Utils.equalsFilter(0, false)).to.be.equal(false);
    expect(Utils.equalsFilter(0, 0)).to.be.equal(true);
    expect(Utils.equalsFilter(false, 0)).to.be.equal(false);
    expect(Utils.equalsFilter(null, null)).to.be.equal(true);
    expect(Utils.equalsFilter(null, false)).to.be.equal(false);
    expect(Utils.equalsFilter(false, null)).to.be.equal(false);
    expect(Utils.equalsFilter({a: 0}, {b: 0})).to.be.equal(false);
    expect(Utils.equalsFilter({a: 0}, {a: 0})).to.be.equal(true);
  });

  describe('sortableFilename', () => {
    it('should trim extensions', () => {
      expect(Utils.sortableFilename("10.jpg")).to.be.equal("10")
    })

    it('should not trim dotfiles to empty strings', () => {
      expect(Utils.sortableFilename(".file")).to.be.equal(".file")
    })

    it('should trim dotfiles with extensions', () => {
      expect(Utils.sortableFilename(".favourite.jpg")).to.be.equal(".favourite")
    })

    it('should not trim without dots', () => {
      expect(Utils.sortableFilename("hello_world")).to.be.equal("hello_world")
    })
  })
});
