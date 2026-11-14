import {expect} from 'chai';
import {foldText} from '../../../../../src/backend/model/database/enitites/EntityUtils';
import {TestHelper} from '../../../../TestHelper';

describe('EntityUtils', () => {
  before(TestHelper.resetConfig);

  // the SQL function fold() of SQLite's search (#1309)
  describe('foldText', () => {
    it('should lowercase and remove the accents', () => {
      expect(foldText('Árvíztűrő TÜKÖRFÚRÓGÉP')).to.equal('arvizturo tukorfurogep');
      expect(foldText('Padmé Amidala')).to.equal('padme amidala');
    });

    it('should remove the accents of text that was already decomposed', () => {
      expect(foldText('Padmé')).to.equal('padme');
    });

    // toLowerCase() makes a word-final Σ a ς, but a typed "οδοσ" has to find "ΟΔΟΣ" too
    it('should fold the Greek final sigma to a sigma', () => {
      expect(foldText('ΟΔΟΣ')).to.equal('οδοσ');
      expect(foldText('οδός')).to.equal(foldText('%ΟΔΟΣ%')!.replace(/%/g, ''));
    });

    it('should keep the letters that have no accent to remove', () => {
      expect(foldText('Øre Łódź straße Ω')).to.equal('øre łodz straße ω');
    });

    // SQLite's LIKE ignores the case of ASCII letters itself
    it('should return ASCII text and null as they are', () => {
      expect(foldText('IMG_0001 Balaton.jpg')).to.equal('IMG_0001 Balaton.jpg');
      expect(foldText(null)).to.equal(null);
    });
  });
});
