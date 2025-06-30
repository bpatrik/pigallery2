/* eslint-disable no-unused-expressions,@typescript-eslint/no-unused-expressions */
import {expect} from 'chai';
import {AuthenticationMWs} from '../../../../../src/backend/middlewares/user/AuthenticationMWs';
import {ErrorCodes, ErrorDTO} from '../../../../../src/common/entities/Error';
import {UserDTO, UserRoles} from '../../../../../src/common/entities/UserDTO';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {Config} from '../../../../../src/common/config/private/Config';
import * as path from 'path';
import {UserManager} from '../../../../../src/backend/model/database/UserManager';


declare const describe: any;
declare const it: any;
declare const beforeEach: any;

describe('Authentication middleware', () => {

  beforeEach(() => {
    ObjectManagers.reset();
  });

  describe('authenticate', () => {
    it('should call next on authenticated', (done: (err?: any) => void) => {
      const req: any = {
        session: {
          user: 'A user'
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
  });


  describe('authorisePath', () => {

    const req = {
      session: {
        user: {permissions: null as string[]}
      },
      sessionOptions: {},
      query: {},
      params: {
        path: '/test'
      }
    };


    const authoriseDirPath = AuthenticationMWs.authorisePath('path', true);
    const test = (relativePath: string): Promise<string | number> => {
      return new Promise((resolve) => {
        req.params.path = path.normalize(relativePath);
        authoriseDirPath(req as any, {sendStatus: resolve} as any, () => {
          resolve('ok');
        });
      });
    };

    it('should catch unauthorized path usage', async () => {
      req.session['user'].permissions = [path.normalize('/sub/subsub')];
      expect(await test('/sub/subsub')).to.be.eql('ok');
      expect(await test('/test')).to.be.eql(403);
      expect(await test('/')).to.be.eql(403);
      expect(await test('/sub/test')).to.be.eql(403);
      expect(await test('/sub/subsub/test')).to.be.eql(403);
      expect(await test('/sub/subsub/test/test2')).to.be.eql(403);
      req.session['user'].permissions = [path.normalize('/sub/subsub'), path.normalize('/sub/subsub2')];
      expect(await test('/sub/subsub2')).to.be.eql('ok');
      expect(await test('/sub/subsub')).to.be.eql('ok');
      expect(await test('/test')).to.be.eql(403);
      expect(await test('/')).to.be.eql(403);
      expect(await test('/sub/test')).to.be.eql(403);
      expect(await test('/sub/subsub/test')).to.be.eql(403);
      expect(await test('/sub/subsub2/test')).to.be.eql(403);
      req.session['user'].permissions = [path.normalize('/sub/subsub*')];
      expect(await test('/b')).to.be.eql(403);
      expect(await test('/sub')).to.be.eql(403);
      expect(await test('/sub/subsub2')).to.be.eql(403);
      expect(await test('/sub/subsub2/test')).to.be.eql(403);
      expect(await test('/sub/subsub')).to.be.eql('ok');
      expect(await test('/sub/subsub/test')).to.be.eql('ok');
      expect(await test('/sub/subsub/test/two')).to.be.eql('ok');
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
          user: 'A user'
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
          user: {
            role: UserRoles.LimitedGuest
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
          user: {
            role: UserRoles.LimitedGuest
          }
        },
        sessionOptions: {}
      };
      const next: any = (err: ErrorDTO) => {
        expect(err).not.to.be.undefined;
        expect(err.code).to.be.eql(ErrorCodes.NOT_AUTHORISED);
        done();
      };
      AuthenticationMWs.authorise(UserRoles.Developer)(req, null, next);

    });
  });

  describe('login', () => {
    beforeEach(() => {
      ObjectManagers.reset();
    });

    describe('should call input ErrorDTO next on missing...', () => {
      it('body', (done: (err?: any) => void) => {
        Config.Users.authenticationRequired = true;
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
        Config.Users.authenticationRequired = true;
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
        Config.Users.authenticationRequired = true;
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
      Config.Users.authenticationRequired = true;
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

    it('should call next with user on the session on  finding user', (done: (err?: any) => void) => {
      Config.Users.authenticationRequired = true;
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
      const next: any = (err: ErrorDTO) => {
        expect(err).to.be.undefined;
        expect(req.session['user']).to.be.eql('test user');
        done();
      };
      ObjectManagers.getInstance().UserManager = {
        findOne: (filter: never) => {
          return Promise.resolve('test user' as any);
        }
      } as UserManager;
      AuthenticationMWs.login(req, null, next);


    });
  });


  describe('logout', () => {
    it('should call next on logout', (done: (err?: any) => void) => {
      const req: any = {
        session: {
          user: {
            role: UserRoles.LimitedGuest
          }
        }
      };
      const next: any = (err: ErrorDTO) => {
        try {
          expect(err).to.be.undefined;
          expect(req.user).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      };
      AuthenticationMWs.logout(req, null, next);

    });

  });

});
