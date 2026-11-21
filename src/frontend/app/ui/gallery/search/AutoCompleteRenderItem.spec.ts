import {AutoCompleteRenderItem} from './AutoCompleteRenderItem';
import {SearchQueryTypes} from '../../../../../common/entities/SearchQueryDTO';

describe('AutoCompleteRenderItem', () => {
  const parts = (text: string, typed: string): string[] => {
    const item = new AutoCompleteRenderItem(text, typed, SearchQueryTypes.keyword, '');
    return [item.preText, item.highLightText, item.postText];
  };

  it('should bold the typed text, ignoring the case', () => {
    expect(parts('Star Wars', 'wars')).toEqual(['Star ', 'Wars', '']);
  });

  // the server suggests "Utazás" for "utaza" (#1309), so it is bold too
  it('should bold the typed text, ignoring the accents', () => {
    expect(parts('Utazás', 'utaza')).toEqual(['', 'Utazá', 's']);
    expect(parts('Nyaralás a Balatonnál', 'BALATONNAL')).toEqual(['Nyaralás a ', 'Balatonnál', '']);
    expect(parts('Árvíztűrő tükörfúrógép', 'tukor')).toEqual(['Árvíztűrő ', 'tükör', 'fúrógép']);
  });

  it('should bold accented text typed with the accents too', () => {
    expect(parts('Padmé Amidala', 'padmé')).toEqual(['', 'Padmé', ' Amidala']);
  });

  it('should keep the whole text unbolded when it does not contain the typed text', () => {
    expect(parts('Balaton', 'pécs')).toEqual(['', '', 'Balaton']);
  });
});
