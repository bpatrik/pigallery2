import {expect} from 'chai';
import {GalleryRouter} from '../../../../src/backend/routes/GalleryRouter';
import {Config} from '../../../../src/common/config/private/Config';
import {TestHelper} from '../../../TestHelper';

declare const describe: any;
declare const it: any;
declare const beforeEach: any;
declare const after: any;

describe('GalleryRouter', () => {
  beforeEach(TestHelper.resetConfig);
  after(TestHelper.resetConfig);

  describe('mediaRoute', () => {
    // private, the routes use it
    const mediaRoute = (formats: string[], suffix?: string): RegExp => GalleryRouter['mediaRoute'](formats, suffix);

    // the router matches the encoded path and decodes the groups afterwards
    const mediaPath = (re: RegExp, url: string): string | null => re.exec(url)?.groups?.['mediaPath'] ?? null;

    it('should match the files of the formats', () => {
      Config.Server.apiPath = '/pgapi';
      const re = mediaRoute(['jpg', 'png']);
      expect(mediaPath(re, '/pgapi/gallery/content/a.jpg')).to.equal('a.jpg');
      expect(mediaPath(re, '/pgapi/gallery/content/a/b%20c/d.png')).to.equal('a/b%20c/d.png');
      expect(mediaPath(re, '/pgapi/gallery/content/a%2Fb.jpg')).to.equal('a%2Fb.jpg');
      expect(mediaPath(re, '/pgapi/gallery/content/dir.jpg/b.png')).to.equal('dir.jpg/b.png');
      expect(mediaPath(re, '/pgapi/gallery/content/a.b.c.jpg')).to.equal('a.b.c.jpg');
      expect(mediaPath(re, '/pgapi/gallery/content/a.jpg/')).to.equal('a.jpg');
    });

    it('should match the format case-insensitively', () => {
      Config.Server.apiPath = '/pgapi';
      const re = mediaRoute(['jpg']);
      expect(mediaPath(re, '/pgapi/gallery/content/a.JPG')).to.equal('a.JPG');
      expect(mediaPath(re, '/PGAPI/Gallery/Content/a.Jpg')).to.equal('a.Jpg');
    });

    it('should not match other files and paths', () => {
      Config.Server.apiPath = '/pgapi';
      const re = mediaRoute(['jpg']);
      for (const url of ['/pgapi/gallery/content/a.txt', '/pgapi/gallery/content/a.jpgx', '/pgapi/gallery/content/ajpg',
        '/pgapi/gallery/content/a.jpg/icon', '/pgapi/gallery/content/a.jpg//', '/pgapi/gallery/content/',
        '/pgapi/gallery/a.jpg', '/x/pgapi/gallery/content/a.jpg', '/pgapi/gallery/content/a.jpg?x']) {
        expect(mediaPath(re, url), url).to.equal(null);
      }
    });

    it('should match the suffix', () => {
      Config.Server.apiPath = '/pgapi';
      const icon = mediaRoute(['mp4'], '/icon');
      expect(mediaPath(icon, '/pgapi/gallery/content/v.mp4/icon')).to.equal('v.mp4');
      expect(mediaPath(icon, '/pgapi/gallery/content/v.mp4/ICON/')).to.equal('v.mp4');
      expect(mediaPath(icon, '/pgapi/gallery/content/v.mp4')).to.equal(null);
      expect(mediaPath(icon, '/pgapi/gallery/content/v.mp4/iconx')).to.equal(null);

      const size = mediaRoute(['jpg'], '/(?<size>[^/]+?)');
      const m = size.exec('/pgapi/gallery/content/a/b.jpg/240/');
      expect(m!.groups).to.deep.equal({mediaPath: 'a/b.jpg', size: '240'});
      expect(size.exec('/pgapi/gallery/content/a.jpg/240/x')).to.equal(null);
    });

    it('should escape the api path and the formats', () => {
      Config.Server.apiPath = '/a.b$c';
      const re = mediaRoute(['jp.g']);
      expect(mediaPath(re, '/a.b$c/gallery/content/x.jp.g')).to.equal('x.jp.g');
      expect(mediaPath(re, '/aXb$c/gallery/content/x.jp.g')).to.equal(null);
      expect(mediaPath(re, '/a.b$c/gallery/content/x.jpXg')).to.equal(null);
    });
  });
});
