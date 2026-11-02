import {CookieHelper} from './cookie.helper';

describe('CookieHelper', () => {
  const name = 'pigallery2-test-cookie';

  afterEach(() => {
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('should return null for a missing cookie', () => {
    expect(CookieHelper.get(name)).toBeNull();
  });

  it('should read back what it set, including non-ASCII text', () => {
    CookieHelper.set(name, 'Árvíztűrő; tükörfúrógép', 1);
    expect(CookieHelper.get(name)).toBe('Árvíztűrő; tükörfúrógép');
  });

  it('should not match a cookie that only starts with the name', () => {
    CookieHelper.set(name + '-other', 'x', 1);
    expect(CookieHelper.get(name)).toBeNull();
    document.cookie = name + '-other=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });
});
