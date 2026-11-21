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

  it('should fall back to the default below User', () => {
    for (const role of [UserRoles.LimitedGuest, UserRoles.Guest]) {
      Config.Album.readAccessMinRole = UserRoles.Admin;
      Config.Album.writeAccessMinRole = UserRoles.User;
      expect(() => Config.Album.readAccessMinRole = role).to.throw();
      expect(Config.Album.readAccessMinRole).to.equal(UserRoles.User);
      expect(() => Config.Album.writeAccessMinRole = role).to.throw();
      expect(Config.Album.writeAccessMinRole).to.equal(UserRoles.Admin);
    }
  });

  it('should reject values that are not a role', () => {
    for (const role of [0, 6, 3.5] as unknown as UserRoles[]) {
      expect(() => Config.Album.readAccessMinRole = role).to.throw();
      expect(Config.Album.readAccessMinRole).to.equal(UserRoles.User);
      expect(() => Config.Album.writeAccessMinRole = role).to.throw();
      expect(Config.Album.writeAccessMinRole).to.equal(UserRoles.Admin);
    }
  });

  it('should accept User, Admin and Developer', () => {
    for (const role of [UserRoles.User, UserRoles.Admin, UserRoles.Developer]) {
      Config.Album.readAccessMinRole = role;
      Config.Album.writeAccessMinRole = role;
      expect(Config.Album.readAccessMinRole).to.equal(role);
      expect(Config.Album.writeAccessMinRole).to.equal(role);
    }
  });
});
