import {expect} from 'chai';
import {ServerUserOIDCConfig} from '../../../../src/common/config/private/PrivateConfig';
import {TAGS} from '../../../../src/common/config/public/ClientConfig';

describe('ServerUserOIDCConfig', () => {

  describe('issuerUrl warning', () => {
    const warning = (value: unknown): string | undefined => {
      const config = new ServerUserOIDCConfig() as unknown as { __state: Record<string, { tags?: TAGS }> };
      return config.__state['issuerUrl'].tags!.uiWarning!(value);
    };

    it('should warn about an http issuer', () => {
      expect(warning('http://localhost:9000/application/o/pigallery2/')).to.be.a('string').that.is.not.empty;
      expect(warning(' HTTP://auth.example.com/')).to.be.a('string').that.is.not.empty;
    });

    it('should not warn about an https or empty issuer', () => {
      expect(warning('https://auth.example.com/application/o/pigallery2/')).to.be.undefined;
      expect(warning('')).to.be.undefined;
      expect(warning(undefined)).to.be.undefined;
    });
  });
});
