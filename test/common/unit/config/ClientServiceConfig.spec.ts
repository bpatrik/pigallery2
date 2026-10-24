import {expect} from 'chai';
import {ClientServiceConfig} from '../../../../src/common/config/public/ClientConfig';
import {Config} from '../../../../src/common/config/private/Config';

describe('ClientServiceConfig urls', () => {

  const create = (urlBase: string, publicUrl = '', apiPath = '/pgapi'): ClientServiceConfig => {
    const c = new ClientServiceConfig();
    c.urlBase = urlBase;
    c.publicUrl = publicUrl;
    c.apiPath = apiPath;
    return c;
  };

  it('should normalize urlBase', () => {
    for (const base of ['', '/', ' / ', '//']) {
      expect(create(base).getUrlBase()).to.equal('', JSON.stringify(base));
    }
    for (const base of ['/galerie', 'galerie', '/galerie/', 'galerie/', ' /galerie// ']) {
      expect(create(base).getUrlBase()).to.equal('/galerie', JSON.stringify(base));
    }
    expect(create('my/galerie/').getUrlBase()).to.equal('/my/galerie');
  });

  it('should build app urls', () => {
    expect(create('').getAppUrl()).to.equal('/');
    expect(create('/').getAppUrl()).to.equal('/');
    expect(create('galerie/').getAppUrl()).to.equal('/galerie/');
    expect(create('').getAppUrl('/share/', 'key')).to.equal('/share/key');
    expect(create('/galerie').getAppUrl('/share/', 'key')).to.equal('/galerie/share/key');
    expect(create('/galerie').getAppUrl('en')).to.equal('/galerie/en');
    expect(create('/galerie').getAppUrl('./', 'gallery')).to.equal('/galerie/gallery');
  });

  it('should build api urls', () => {
    expect(create('').getApiUrl()).to.equal('/pgapi');
    expect(create('/galerie').getApiUrl()).to.equal('/galerie/pgapi');
    expect(create('/galerie/').getApiUrl('/gallery/content/', 'a/b.jpg', '240'))
      .to.equal('/galerie/pgapi/gallery/content/a/b.jpg/240');
    expect(create('/galerie', '', 'pgapi').getApiUrl('/auth/oidc/login')).to.equal('/galerie/pgapi/auth/oidc/login');
  });

  it('should build public urls', () => {
    expect(create('').getPublicUrl()).to.equal('/');
    expect(create('/galerie').getPublicUrl('/share/', 'key')).to.equal('/galerie/share/key');
    expect(create('', 'https://foo.moo').getPublicUrl('/share/', 'key')).to.equal('https://foo.moo/share/key');
    expect(create('/bird', 'https://foo.moo/').getPublicUrl('/share/', 'key')).to.equal('https://foo.moo/bird/share/key');
    expect(create('/bird', 'http://foo.moo:8080').getPublicUrl()).to.equal('http://foo.moo:8080/bird/');
  });

  it('should be available on the server config', () => {
    const orig = Config.Server.urlBase;
    try {
      Config.Server.urlBase = 'galerie';
      expect(Config.Server.getApiUrl('/x')).to.equal(Config.Server.getUrlBase() + Config.Server.apiPath + '/x');
      expect(Config.Server.getAppUrl()).to.equal('/galerie/');
    } finally {
      Config.Server.urlBase = orig;
    }
  });
});
