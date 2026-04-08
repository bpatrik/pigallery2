/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import {expect} from 'chai';
import {AuthenticationMWs} from '../../../../../src/backend/middlewares/user/AuthenticationMWs';
import {ErrorCodes, ErrorDTO} from '../../../../../src/common/entities/Error';
import {UserDTO, UserRoles} from '../../../../../src/common/entities/UserDTO';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Config} from '../../../../../src/common/config/private/Config';
import * as path from 'path';
import {UserManager} from '../../../../../src/backend/model/database/UserManager';
import {SearchQueryTypes, TextSearchQueryMatchTypes} from '../../../../../src/common/entities/SearchQueryDTO';
import {DBTestHelper} from '../../../DBTestHelper';


declare let describe: any;
declare const it: any;
declare const before: any;
declare const beforeEach: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Authentication middleware', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;

  before(sqlHelper.clearDB);

  beforeEach(async () => {
    await sqlHelper.initDB();
  });


  describe('authenticate', () => {
    it('should call next on authenticated', (done: (err?: any) => void) => {
      const req: any = {
        session: {
          context: {
            user: 'A user'
          }
        },
        sessionOptions: {},
        query: {},
        params: {}
      };
      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      AuthenticationMWs.authenticate(req, null, next);

    });

    it('should call next with error on not authenticated', (done: (err?: any) => void) => {
      const req: any = {
        session: {},
        sessionOptions: {},
        query: {},
        params: {}
      };
      Config.Users.authenticationRequired = true;
      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).not.to.be.undefined;
          expect(err.code).to.be.eql(ErrorCodes.NOT_AUTHENTICATED);
          done();
        } catch (err) {
          done(err);
        }
      };
      AuthenticationMWs.authenticate(req, {
        status: () => {
          // empty
        }
      } as any, next);

    });

    it('should rebuild context to restore projectionQuery if missing but projectionKey is present', async () => {
      Config.Users.authenticationRequired = true;
      const user: any = {name: 'Guest', role: UserRoles.LimitedGuest, projectionKey: 'k1'};
      const rebuiltContext: any = {user, projectionQuery: {some: 'query'}};
      const req: any = {
        session: {context: {user, projectionQuery: undefined}},
        query: {},
        params: {}
      };
      let called = 0;
      const orig = ObjectManagers.getInstance().SessionManager.buildContext;
      ObjectManagers.getInstance().SessionManager.buildContext = async (u: any) => {
        called++;
        expect(u).to.eql(user);
        return rebuiltContext;
      };
      let nextErr: any = 'not-called';
      await AuthenticationMWs.authenticate(req, null as any, (err: any) => {
        nextErr = err;
      });
      // restore
      ObjectManagers.getInstance().SessionManager.buildContext = orig;

      expect(nextErr).to.be.undefined;
      expect(called).to.eql(1);
      expect(req.session.context).to.eql(rebuiltContext);
      expect(req.session.context.projectionQuery).to.deep.equal({some: 'query'});
    });

    it('should rebuild context if projectionQuery is an empty object', async () => {
      Config.Users.authenticationRequired = true;
      const user: any = {name: 'Guest', role: UserRoles.LimitedGuest, projectionKey: 'k-empty'};
      const rebuiltContext: any = {user, projectionQuery: {restored: true}};
      const req: any = {
        session: {context: {user, projectionQuery: {}}},
        query: {},
        params: {}
      };
      let called = 0;
      const orig = ObjectManagers.getInstance().SessionManager.buildContext;
      ObjectManagers.getInstance().SessionManager.buildContext = async (u: any) => {
        called++;
        expect(u).to.eql(user);
        return rebuiltContext;
      };
      let nextErr: any = 'not-called';
      await AuthenticationMWs.authenticate(req, null as any, (err: any) => {
        nextErr = err;
      });
      ObjectManagers.getInstance().SessionManager.buildContext = orig;

      expect(nextErr).to.be.undefined;
      expect(called).to.eql(1);
      expect(req.session.context).to.eql(rebuiltContext);
      expect(req.session.context.projectionQuery).to.deep.equal({restored: true});
    });

    it('should NOT rebuild context if projectionQuery is present', async () => {
      Config.Users.authenticationRequired = true;
      const user: any = {name: 'Guest', role: UserRoles.LimitedGuest, projectionKey: 'k2'};
      const originalContext: any = {user, projectionQuery: {ok: true}};
      const req: any = {session: {context: originalContext}, query: {}, params: {}};

      let called = 0;
      const orig = ObjectManagers.getInstance().SessionManager.buildContext;
      (ObjectManagers.getInstance().SessionManager as any).buildContext = async () => {
        called++;
        return originalContext;
      };
      let nextErr: any = 'not-called';
      await AuthenticationMWs.authenticate(req, null as any, (err: any) => {
        nextErr = err;
      });
      (ObjectManagers.getInstance().SessionManager as any).buildContext = orig;

      expect(nextErr).to.be.undefined;
      expect(called).to.eql(0);
      expect(req.session.context).to.eql(originalContext);
    });
  });

  describe('inverseAuthenticate', () => {

    it('should call next with error on authenticated', (done: (err?: any) => void) => {
      const req: any = {
        session: {},
        sessionOptions: {},
      };
      const res: any = {};
      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      AuthenticationMWs.inverseAuthenticate(req, null, next);

    });


    it('should call next error on authenticated', (done: (err?: any) => void) => {
      const req: any = {
        session: {
          context: {
            user: 'A user'
          }
        },
        sessionOptions: {},
      };
      const next: any = (err: ErrorDTO) => {
        expect(err).not.to.be.undefined;
        expect(err.code).to.be.eql(ErrorCodes.ALREADY_AUTHENTICATED);
        done();
      };
      AuthenticationMWs.inverseAuthenticate(req, null, next);

    });
  });

  describe('authorise', () => {
    it('should call next on authorised', (done: (err?: any) => void) => {
      const req: any = {
        session: {
          context: {
            user: {
              role: UserRoles.LimitedGuest
            }
          }
        },
        sessionOptions: {}
      };
      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      AuthenticationMWs.authorise(UserRoles.LimitedGuest)(req, null, next);

    });

    it('should call next with error on not authorised', (done: (err?: any) => void) => {
      const req: any = {
        session: {
          context: {
            user: {
              role: UserRoles.LimitedGuest
            }
          }
        },
        sessionOptions: {}
      };
      const next: any = (err: ErrorDTO) => {
        expect(err).not.to.be.undefined;
        expect(err.code).to.be.eql(ErrorCodes.NOT_AUTHORISED);
        done();
      };
      AuthenticationMWs.authorise(UserRoles.Developer)(req, {
        status: () => {
          // empty
        }
      } as any, next);

    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await sqlHelper.initDB();
    });

    describe('should call input ErrorDTO next on missing...', () => {
      it('body', (done: (err?: any) => void) => {
        const req: any = {
          query: {},
          params: {}
        };
        const next: any = (err: ErrorDTO) => {
          expect(err).not.to.be.undefined;
          expect(err.code).to.be.eql(ErrorCodes.INPUT_ERROR);
          done();
        };
        AuthenticationMWs.login(req, null, next);

      });

      it('loginCredential', (done: (err?: any) => void) => {
        const req: any = {
          body: {},
          query: {},
          params: {}
        };
        const next: any = (err: ErrorDTO) => {
          try {
            expect(err).not.to.be.undefined;
            expect(err.code).to.be.eql(ErrorCodes.INPUT_ERROR);
            done();
          } catch (err) {
            done(err);
          }
        };
        AuthenticationMWs.login(req, null, next);


      });


      it('loginCredential content', (done: (err?: any) => void) => {
        const req: any = {
          body: {loginCredential: {}},
          query: {},
          params: {}
        };
        const next: any = (err: ErrorDTO) => {
          try {
            expect(err).not.to.be.undefined;
            expect(err.code).to.be.eql(ErrorCodes.INPUT_ERROR);
            done();
          } catch (err) {
            done(err);
          }
        };
        AuthenticationMWs.login(req, null, next);


      });

    });
    it('should call next with error on not finding user', (done: (err?: any) => void) => {
      const req: any = {
        body: {
          loginCredential: {
            username: 'aa',
            password: 'bb'
          }
        },
        query: {},
        params: {}
      };
      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).not.to.be.undefined;
          expect(err.code).to.be.eql(ErrorCodes.CREDENTIAL_NOT_FOUND);
          done();
        } catch (err) {
          done(err);
        }
      };
      ObjectManagers.getInstance().UserManager = {
        findOne: (_: never): Promise<UserDTO> => {
          return Promise.reject(null);
        }
      } as UserManager;
      AuthenticationMWs.login(req, null, next);


    });

    it('should call next with user on the session on finding user', (done: (err?: any) => void) => {
      const req: any = {
        session: {},
        body: {
          loginCredential: {
            username: 'aa',
            password: 'bb'
          }
        },
        query: {},
        params: {}
      };
      const testUser = 'test user';
      const testContext = {user: testUser};

      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          expect(req.session.context).to.be.eql(testContext);
          done();
        } catch (error) {
          console.error(error);
          done(error);
        }
      };

      ObjectManagers.getInstance().UserManager = {
        findOne: (filter: never) => {
          return Promise.resolve(testUser);
        }
      } as any;

      // Add SearchManager mock to avoid errors in buildContext
      ObjectManagers.getInstance().SearchManager = {
        prepareAndBuildWhereQuery: (query: any) => {
          return Promise.resolve(null);
        }
      } as any;

      // @ts-ignore
      ObjectManagers.getInstance().SessionManager.buildContext = async (user: any) => {
        expect(user).to.be.eql(testUser);
        return testContext;
      };


      AuthenticationMWs.login(req, null, next);
    });

    it('should create context with allowQuery', (done: (err?: any) => void) => {
      const req: any = {
        session: {},
        body: {
          loginCredential: {
            username: 'aa',
            password: 'bb'
          }
        },
        query: {},
        params: {}
      };

      const testUser = {
        name: 'testuser',
        role: UserRoles.Admin,
        allowQuery: {
          type: SearchQueryTypes.directory,
          text: '/allowed/path',
          matchType: TextSearchQueryMatchTypes.exact_match
        }
      };

      const projectionQuery = {someQueryObject: true};
      const testContext = {
        user: testUser,
        projectionQuery: projectionQuery
      };

      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          expect(req.session?.context).to.be.eql(testContext);
          done();
        } catch (e) {
          done(e);
        }
      };

      ObjectManagers.getInstance().UserManager = {
        findOne: (filter: never) => {
          return Promise.resolve(testUser);
        }
      } as any;


      // @ts-ignore
      ObjectManagers.getInstance().SessionManager.buildContext = async (user: any) => {
        expect(user).to.be.eql(testUser);
        return testContext;
      };


      AuthenticationMWs.login(req, null, next);
    });

    it('should create context with blockQuery', (done: (err?: any) => void) => {
      const req: any = {
        session: {},
        body: {
          loginCredential: {
            username: 'aa',
            password: 'bb'
          }
        },
        query: {},
        params: {}
      };

      const testUser = {
        name: 'testuser',
        role: UserRoles.Admin,
        blockQuery: {
          type: SearchQueryTypes.directory,
          text: '/blocked/path',
          matchType: TextSearchQueryMatchTypes.exact_match
        }
      };

      const projectionQuery = {someQueryObject: true};
      const testContext = {
        user: testUser,
        projectionQuery: projectionQuery
      };


      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          expect(req.session?.context).to.be.eql(testContext);
          done();
        } catch (e) {
          done(e);
        }
      };

      // @ts-ignore
      ObjectManagers.getInstance().UserManager = {
        findOne: (filter: never) => {
          return Promise.resolve(testUser);
        }
      } as UserManager;

      ObjectManagers.getInstance().SearchManager = {
        prepareAndBuildWhereQuery: (query: any) => {
          // In real code, the blockQuery would be negated first
          expect(query).not.to.be.undefined;
          return Promise.resolve(projectionQuery);
        }
      } as any;

      // @ts-ignore
      ObjectManagers.getInstance().SessionManager.buildContext = async (user: any) => {
        expect(user).to.be.eql(testUser);
        return testContext;
      };

      AuthenticationMWs.login(req, null, next);
    });

    it('should create context with both allowQuery and blockQuery', (done: (err?: any) => void) => {
      const req: any = {
        session: {},
        body: {
          loginCredential: {
            username: 'aa',
            password: 'bb'
          }
        },
        query: {},
        params: {}
      };

      const testUser = {
        name: 'testuser',
        role: UserRoles.Admin,
        allowQuery: {
          type: SearchQueryTypes.directory,
          text: '/allowed/path',
          matchType: TextSearchQueryMatchTypes.exact_match
        },
        blockQuery: {
          type: SearchQueryTypes.directory,
          text: '/blocked/path',
          matchType: TextSearchQueryMatchTypes.exact_match
        }
      };

      const projectionQuery = {someQueryObject: true};
      const testContext = {
        user: {
          ...testUser,
          projectionKey: 'some-hash-value'
        },
        projectionQuery: projectionQuery
      };

      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          expect(req.session.context).to.be.eql(testContext);
          expect(req.session.context.user.projectionKey).not.to.be.undefined;
          done();
        } catch (e) {
          done(e);
        }
      };

      // @ts-ignore
      ObjectManagers.getInstance().UserManager = {
        findOne: (filter: never) => {
          return Promise.resolve({...testUser});
        }
      } as UserManager;

      ObjectManagers.getInstance().SearchManager = {
        prepareAndBuildWhereQuery: (query: any) => {
          // In the real code, this would be an AND query combining allowQuery and negated blockQuery
          expect(query.type).to.be.eql(SearchQueryTypes.AND);
          expect(query.list).to.have.lengthOf(2);
          return Promise.resolve(projectionQuery);
        }
      } as any;

      // @ts-ignore
      ObjectManagers.getInstance().SessionManager.buildContext = async (user: any) => {
        expect(user).to.deep.include({
          name: testUser.name,
          role: testUser.role
        });
        return testContext;
      };

      AuthenticationMWs.login(req, null, next);
    });
  });


  describe('authoriseMedia', () => {

    const buildReq = (mediaRelPath: string) => ({
      session: {
        context: {
          user: {role: UserRoles.LimitedGuest}
        }
      },
      params: {
        mediaPath: path.normalize(mediaRelPath)
      }
    });

    const run = (req: any) => new Promise((resolve) => {
      const res = {sendStatus: (code: number) => resolve(code)} as any;
      const next = () => resolve('ok');
      const mw = AuthenticationMWs.authoriseMedia('mediaPath');
      // Normalization is called by the router, mimic it here
      AuthenticationMWs.normalizePathParam('mediaPath')(req as any, {} as any, () => {
        (mw as any)(req as any, res, next);
      });
    });

    it('should call next if GalleryManager.authoriseMedia allows', async () => {
      const req = buildReq('/allowed/dir/photo.jpg');

      // Mock GalleryManager to allow
      (ObjectManagers.getInstance() as any).GalleryManager = {
        authoriseMedia: async (_session: any, _mediaPath: string) => true
      } as any;

      const result = await run(req);
      expect(result).to.eql('ok');
    });

    it('should deny if GalleryManager.authoriseMedia denies', async () => {
      const req = buildReq('/allowed/dir/photo.jpg');

      // Mock GalleryManager to deny
      (ObjectManagers.getInstance() as any).GalleryManager = {
        authoriseMedia: async (_session: any, _mediaPath: string) => false
      } as any;

      const result = await run(req);
      expect(result).to.eql(403);
    });

    it('should deny (403) on error thrown by GalleryManager.authoriseMedia', async () => {
      const req = buildReq('/allowed/dir/photo.jpg');

      (ObjectManagers.getInstance() as any).GalleryManager = {
        authoriseMedia: async () => {
          throw new Error('db error');
        }
      } as any;

      const result = await run(req);
      expect(result).to.eql(403);
    });
  });

  describe('authoriseMetaFiles', () => {
    const buildReq = (metaPath: string) => ({
      session: {
        context: {
          user: {role: UserRoles.LimitedGuest}
        }
      },
      params: {
        metaPath: path.normalize(metaPath)
      }
    });

    const run = (req: any) => new Promise((resolve) => {
      const res = {sendStatus: (code: number) => resolve(code)} as any;
      const next = () => resolve('ok');
      const mw = AuthenticationMWs.authoriseMetaFiles('metaPath');
      AuthenticationMWs.normalizePathParam('metaPath')(req as any, {} as any, () => {
        (mw as any)(req as any, res, next);
      });
    });

    it('should call next if GalleryManager.authoriseMetaFile allows', async () => {
      const req = buildReq('/some/dir/notes.md');
      (ObjectManagers.getInstance() as any).GalleryManager = {
        authoriseMetaFile: async (_session: any, _path: string) => true
      } as any;
      const result = await run(req);
      expect(result).to.eql('ok');
    });

    it('should deny if GalleryManager.authoriseMetaFile denies', async () => {
      const req = buildReq('/some/dir/notes.md');
      (ObjectManagers.getInstance() as any).GalleryManager = {
        authoriseMetaFile: async (_session: any, _path: string) => false
      } as any;
      const result = await run(req);
      expect(result).to.eql(403);
    });

    it('should deny (403) on error thrown by GalleryManager.authoriseMetaFile', async () => {
      const req = buildReq('/some/dir/notes.md');
      (ObjectManagers.getInstance() as any).GalleryManager = {
        authoriseMetaFile: async () => {
          throw new Error('db error');
        }
      } as any;
      const result = await run(req);
      expect(result).to.eql(403);
    });
  });

  describe('logout', () => {
    it('should call next on logout', (done: (err?: any) => void) => {
      const req: any = {
        session: {
          context: {
            user: {
              role: UserRoles.LimitedGuest
            }
          }
        }
      };
      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          expect(req.session.context).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      AuthenticationMWs.logout(req, null, next);

    });

  });

});
