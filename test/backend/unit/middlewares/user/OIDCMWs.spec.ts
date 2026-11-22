import {expect} from 'chai';
import {AuthorizationResponseError} from 'openid-client';
import {OIDCMWs} from '../../../../../src/backend/middlewares/user/OIDCMWs';
import {ErrorCodes, ErrorDTO} from '../../../../../src/common/entities/Error';
import {Config} from '../../../../../src/common/config/private/Config';
import {NotificationManager} from '../../../../../src/backend/model/NotifocationManager';
import {TestHelper} from '../../../../TestHelper';
import express from 'express';
import {request} from 'chai-http';
import {SuperAgentStatic} from 'superagent';
import {OIDCRouter} from '../../../../../src/backend/routes/OIDCRouter';
import {ErrorRouter} from '../../../../../src/backend/routes/ErrorRouter';

describe('OIDCMWs', () => {
  before(TestHelper.resetConfig);

  describe('redirectToLoginOnError', () => {
    let notificationCount: number;
    beforeEach(() => {
      Config.Server.urlBase = '/gallery';
      notificationCount = NotificationManager.notifications.length;
    });
    afterEach(() => {
      Config.Server.urlBase = '';
      NotificationManager.notifications.length = notificationCount;
    });

    const redirectOf = (err: unknown): string => {
      let redirectedTo = '';
      const res = {redirect: (url: string): void => { redirectedTo = url; }};
      OIDCMWs.redirectToLoginOnError(err, {} as never, res as never, () => {
        throw new Error('next() should not be called');
      });
      return redirectedTo;
    };

    // #1422
    it('should send the user to the login page when the provider denies the access', () => {
      const err = new AuthorizationResponseError('authorization response from the server is an error', {
        cause: new URLSearchParams('error=access_denied&error_description=not+in+the+group')
      });
      expect(redirectOf(err)).to.equal('/gallery/login?oidcError=denied');
      // an expected outcome, not a server error for the admin
      expect(NotificationManager.notifications.length).to.equal(notificationCount);
    });

    it('should report an unknown user as access denied', () => {
      expect(redirectOf(new ErrorDTO(ErrorCodes.CREDENTIAL_NOT_FOUND, 'User not found'))).to.equal('/gallery/login?oidcError=denied');
    });

    it('should report other failures as a failed login', () => {
      expect(redirectOf(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Invalid OIDC state'))).to.equal('/gallery/login?oidcError=failed');
      expect(NotificationManager.notifications.length).to.equal(notificationCount);
    });

    it('should notify the admin about unexpected errors', () => {
      expect(redirectOf(new Error('provider is down'))).to.equal('/gallery/login?oidcError=failed');
      expect(NotificationManager.notifications.length).to.equal(notificationCount + 1);
    });

    it('should handle the callback error before the app wide error handler', async () => {
      Config.Users.oidc.enabled = true;
      try {
        const app = express();
        app.use((req, res, next) => {
          req.session = {} as never;
          next();
        });
        OIDCRouter.route(app);
        ErrorRouter.route(app);
        // no login was started, so the state does not match
        const res = await (request.execute(app) as SuperAgentStatic)
          .get(Config.Server.apiPath + '/auth/oidc/callback?error=access_denied&state=x')
          .redirects(0);
        expect(res.status).to.equal(302);
        expect(res.headers['location']).to.equal('/gallery/login?oidcError=failed');
      } finally {
        Config.Users.oidc.enabled = false;
      }
    });
  });
});
