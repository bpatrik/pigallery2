import {expect} from 'chai';
import {ExtensionConfigWrapper} from '../../../../../src/backend/model/extension/ExtensionConfigWrapper';
import {TAGS} from '../../../../../src/common/config/public/ClientConfig';

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
declare const before: any;
declare const it: any;


describe('ExtensionConfigWrapper', () => {

  it('should load original config multiple times with the same result', async () => {
    const get = async () => JSON.parse(JSON.stringify((await ExtensionConfigWrapper.original()).toJSON({
      attachState: true,
      attachVolatile: true,
      skipTags: {secret: true} as TAGS
    })));
    const a = await get();
    const b = await get();
    expect(b).to.deep.equal(a);
    const c = await get();
    expect(c).to.deep.equal(a);
  });
});
