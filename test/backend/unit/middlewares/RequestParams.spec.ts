import {expect} from 'chai';
import {Request} from 'express';
import {RequestParams} from '../../../../src/backend/middlewares/RequestParams';

declare const describe: any;
declare const it: any;

describe('RequestParams', () => {
  const req = (params: Record<string, string | string[]>): Request => ({params} as unknown as Request);

  it('should return a plain param as it is', () => {
    expect(RequestParams.get(req({id: '12'}), 'id')).to.equal('12');
    expect(RequestParams.get(req({name: 'Árvíztűrő tükörfúrógép'}), 'name')).to.equal('Árvíztűrő tükörfúrógép');
    expect(RequestParams.get(req({name: ''}), 'name')).to.equal('');
  });

  it('should return undefined for a missing param', () => {
    // Express 5 leaves out unmatched params, e.g. an empty {*directory}
    expect(RequestParams.get(req({}), 'directory')).to.equal(undefined);
  });

  it('should join the segments of a wildcard param', () => {
    expect(RequestParams.get(req({directory: ['a']}), 'directory')).to.equal('a');
    expect(RequestParams.get(req({directory: ['a', 'b', 'c.jpg']}), 'directory')).to.equal('a/b/c.jpg');
    // non-ASCII segments are joined as they are
    expect(RequestParams.get(req({directory: ['árvíztűrő', 'tükörfúrógép 1.jpg']}), 'directory')).to.equal('árvíztűrő/tükörfúrógép 1.jpg');
  });

  it('should give the same string as Express 4 for encoded slashes, empty segments and trailing slashes', () => {
    // a%2Fb/c -> segments ['a/b', 'c']
    expect(RequestParams.get(req({p: ['a/b', 'c']}), 'p')).to.equal('a/b/c');
    // a//b
    expect(RequestParams.get(req({p: ['a', '', 'b']}), 'p')).to.equal('a//b');
    // a/
    expect(RequestParams.get(req({p: ['a', '']}), 'p')).to.equal('a/');
    // //
    expect(RequestParams.get(req({p: ['', '']}), 'p')).to.equal('/');
  });
});
