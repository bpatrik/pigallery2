import {expect} from 'chai';
import {Config} from '../../../../src/common/config/private/Config';
import {UserRoles} from '../../../../src/common/entities/UserDTO';
import {TestHelper} from '../../../TestHelper';

describe('Album config rights #557', () => {
  beforeEach(TestHelper.resetConfig);
  after(TestHelper.resetConfig);

  it('should let only Admins create and delete albums by default', () => {
    expect(Config.Album.writeAccessMinRole).to.equal(UserRoles.Admin);
    expect(Config.Album.readAccessMinRole).to.equal(UserRoles.User);
  });

  it('should not go below User', () => {
    for (const role of [UserRoles.LimitedGuest, UserRoles.Guest]) {
      expect(() => Config.Album.readAccessMinRole = role).to.throw();
      expect(Config.Album.readAccessMinRole).to.equal(UserRoles.User);
      expect(() => Config.Album.writeAccessMinRole = role).to.throw();
      expect(Config.Album.writeAccessMinRole).to.not.equal(role);
    }
    Config.Album.writeAccessMinRole = UserRoles.User;
    expect(Config.Album.writeAccessMinRole).to.equal(UserRoles.User);
  });

  it('should let the read right be only User or Admin', () => {
    expect(() => Config.Album.readAccessMinRole = UserRoles.Developer).to.throw();
    expect(Config.Album.readAccessMinRole).to.equal(UserRoles.User);
    Config.Album.readAccessMinRole = UserRoles.Admin;
    expect(Config.Album.readAccessMinRole).to.equal(UserRoles.Admin);
  });

  it('should not let the write right go below the read right, it falls back to Admin', () => {
    Config.Album.readAccessMinRole = UserRoles.Admin;
    Config.Album.writeAccessMinRole = UserRoles.Developer;
    expect(() => Config.Album.writeAccessMinRole = UserRoles.User).to.throw();
    expect(Config.Album.writeAccessMinRole).to.equal(UserRoles.Admin);
  });
});
