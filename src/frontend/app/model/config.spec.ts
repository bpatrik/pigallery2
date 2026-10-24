import {resolvePublicUrl} from '../../../common/config/public/Config';

describe('resolvePublicUrl', () => {
  const origin = 'https://example.com';

  it('should keep a configured publicUrl and ignore origin and urlBase', () => {
    expect(resolvePublicUrl('https://share.example.org/photos', '/photos', origin))
        .toBe('https://share.example.org/photos');
  });

  it('should fall back to origin when publicUrl and urlBase are unset', () => {
    expect(resolvePublicUrl('', '', origin)).toBe(origin);
  });

  it('should append urlBase to origin when publicUrl is unset', () => {
    expect(resolvePublicUrl('', '/myGallery', origin)).toBe('https://example.com/myGallery');
  });

  it('should normalize a urlBase without leading slash', () => {
    expect(resolvePublicUrl('', 'myGallery', origin)).toBe('https://example.com/myGallery');
  });

  it('should normalize a urlBase with trailing slash', () => {
    expect(resolvePublicUrl('', '/myGallery/', origin)).toBe('https://example.com/myGallery');
  });
});
