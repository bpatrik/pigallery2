import {expect} from 'chai';
import * as express from 'express';
import {ExtensionManager} from '../../../../../src/backend/model/extension/ExtensionManager';
import {IExtensionObject} from '../../../../../src/backend/model/extension/IExtension';
import {TestHelper} from '../../../../TestHelper';

// to help WebStorm to handle the test cases
declare let describe: any;
declare const before: any;
declare const it: any;


describe('ExtensionManager', () => {
  before(TestHelper.resetConfig);

  it('should give every extension with the same name its own object', () => {
    const em = new ExtensionManager();
    em.router = express.Router();
    const create = (folder: string): IExtensionObject<unknown> => (em as any).createUniqueExtensionObject('sample', folder);

    const ids = ['a', 'b', 'c', 'd'].map((folder) => create(folder).extensionId);

    expect(ids).to.deep.equal(['sample', 'sample_2', 'sample_3', 'sample_4']);
    expect(Object.values(em.extObjects).map((o) => o.folder)).to.deep.equal(['a', 'b', 'c', 'd']);
  });
});
