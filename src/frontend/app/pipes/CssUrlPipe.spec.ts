import {CssUrlPipe} from './CssUrlPipe';

describe('CssUrlPipe', () => {
  const pipe = new CssUrlPipe();

  it('should wrap the url into css url()', () => {
    expect(pipe.transform('api/gallery/content/Balaton/IMG_001.jpg/thumbnail/240'))
      .toBe('url(api/gallery/content/Balaton/IMG_001.jpg/thumbnail/240)');
  });

  it('should escape parentheses and single quotes', () => {
    expect(pipe.transform('api/gallery/content/Nyár/árvíztűrő (1).jpg'))
      .toBe('url(api/gallery/content/Nyár/árvíztűrő %281%29.jpg)');
    expect(pipe.transform('api/gallery/content/Tükörfúrógép/Péter\'s (2) (copy).jpg'))
      .toBe('url(api/gallery/content/Tükörfúrógép/Péter%27s %282%29 %28copy%29.jpg)');
  });

  it('should keep accented characters and double quotes as they are', () => {
    expect(pipe.transform('Őszi "kirándulás"/ÁRVÍZTŰRŐ.jpg'))
      .toBe('url(Őszi "kirándulás"/ÁRVÍZTŰRŐ.jpg)');
  });
});
