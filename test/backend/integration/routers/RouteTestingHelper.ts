import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {Utils} from '../../../../src/common/Utils';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../src/common/entities/SearchQueryDTO';
import * as chai from 'chai';
import {SharingEntity} from '../../../../src/backend/model/database/enitites/SharingEntity';

const should = chai.should();

export class RouteTestingHelper {


  static async createSharing(testUser: UserDTO, password: string = null): Promise<SharingEntity> {
    const sharing = {
      sharingKey: 'sharing_test_key_' + Date.now(),
      searchQuery: {type: SearchQueryTypes.directory, value: 'test', matchType: TextSearchQueryMatchTypes.exact_match} as TextSearch,
      expires: Date.now() + 1000,
      timeStamp: Date.now(),
      creator: testUser
    } as any;
    if (password) {
      sharing.password = password;
    }
    await ObjectManagers.getInstance().SharingManager.createSharing(Utils.clone(sharing)); // do not rewrite the password
    return sharing;
  }

  public static getExpectedSharingUserForUI(sharing: SharingEntity): UserDTO {
    const u = {
      name: 'Guest',
      role: UserRoles.LimitedGuest,
      usedSharingKey: sharing.sharingKey,
    } as UserDTO;
    const q = ObjectManagers.getInstance().SessionManager.buildAllowListForSharing(sharing as any);
    u.projectionKey = ObjectManagers.getInstance().SessionManager.createProjectionKey(q);

    return u;
  }

  /**
   * Check if the result sent to UI is a valid user object
   * @param result
   * @param user
   */
  public static shouldBeValidUIUser = (result: any, user: any) => {

    result.should.have.status(200);
    result.body.should.be.a('object');
    should.equal(result.body.error, null);
    const {...u} = result.body.result;
    // Ensure sensitive fields are not leaked
    (u as any).should.not.have.property('password');
    // Ensure server does not leak internal allow/block queries
    (u as any).should.not.have.property('allowQuery');
    (u as any).should.not.have.property('blockQuery');
    (u as any).should.not.have.property('overrideAllowBlockList');

    // Check core identity fields
    (u as any).should.have.property('name', user.name);
    (u as any).should.have.property('role', user.role);
    if (typeof user.id !== 'undefined') {
      (u as any).should.have.property('id', user.id);
    }
    if (typeof user.usedSharingKey !== 'undefined') {
      (u as any).should.have.property('usedSharingKey', user.usedSharingKey);
    }
    // projectionKey may be present; if present, ensure it is a non-empty string
    if (typeof (u as any).projectionKey !== 'undefined') {
      (u as any).projectionKey.should.be.a('string');
      ((u as any).projectionKey as string).length.should.be.greaterThan(0);
    }
    u.should.deep.equal(user);
  };
}
