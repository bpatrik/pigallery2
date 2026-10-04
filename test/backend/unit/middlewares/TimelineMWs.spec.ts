import {expect} from 'chai';
import {Config} from '../../../../src/common/config/private/Config';
import {ErrorCodes, ErrorDTO} from '../../../../src/common/entities/Error';
import {UserRoles} from '../../../../src/common/entities/UserDTO';
import {TimelineMWs} from '../../../../src/backend/middlewares/TimelineMWs';

declare const describe: any;
declare const it: any;

describe('TimelineMWs', () => {
  function checkAvailable(user: any): {status: number; error?: ErrorDTO} {
    const response = {
      code: 200,
      status(value: number) {
        this.code = value;
        return this;
      },
    };
    let error: ErrorDTO;
    TimelineMWs.checkAvailable(
      {session: {context: {user}}} as any,
      response as any,
      ((nextError?: any) => { error = nextError; }) as any
    );
    return {status: response.code, error};
  }

  it('denies a disabled Timeline, low roles, and sharing sessions', () => {
    const wasEnabled = Config.Timeline.enabled;
    const wasMinimum = Config.Timeline.readAccessMinRole;
    Config.Timeline.enabled = false;
    expect(checkAvailable({role: UserRoles.Admin}).status).to.equal(403);

    Config.Timeline.enabled = true;
    Config.Timeline.readAccessMinRole = UserRoles.User;
    expect(checkAvailable({role: UserRoles.Guest}).status).to.equal(403);
    expect(
      checkAvailable({role: UserRoles.User, usedSharingKey: 'share-key'}).status
    ).to.equal(403);

    Config.Timeline.enabled = wasEnabled;
    Config.Timeline.readAccessMinRole = wasMinimum;
  });

  it('allows an eligible non-sharing user', () => {
    Config.Timeline.enabled = true;
    Config.Timeline.readAccessMinRole = UserRoles.Guest;
    expect(checkAvailable({role: UserRoles.Guest}).status).to.equal(200);
  });

  it('rejects invalid page parameters with HTTP 400 before querying', async () => {
    const invalidQueries = [
      {limit: '0'},
      {limit: '201'},
      {limit: '1.5'},
      {from: '100'},
      {after: '2'},
      {from: '100', after: '-1'},
      {before: '100', from: '90', after: '1'},
      {before: '9007199254740992'},
      {from: '8640000000000001', after: '1'},
    ];
    for (const query of invalidQueries) {
      let status = 200;
      let received: ErrorDTO;
      await TimelineMWs.listMedia(
        {query, session: {context: {user: {role: UserRoles.Guest}}}} as any,
        {status(value: number) { status = value; return this; }} as any,
        ((error?: any) => { received = error; }) as any
      );
      expect(status, JSON.stringify(query)).to.equal(400);
      expect(received).to.be.instanceOf(ErrorDTO);
      expect(received.code).to.equal(ErrorCodes.INPUT_ERROR);
    }
  });
});