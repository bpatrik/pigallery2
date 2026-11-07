import {LoginCredential} from '../../../common/entities/LoginCredential';
import {SessionContext} from '../../model/SessionContext';
import {DirectoryAccessTypes} from '../../model/DirectoryAccess';

declare global {
  namespace Express {
    interface Request {
      // sending data between middlewares. Next middleware will expect the output of the previous one in this field.
      resultPipe?: unknown;
      // set by AuthenticationMWs.authoriseDirectory
      directoryAccess?: DirectoryAccessTypes;
      body?: {
        loginCredential?: LoginCredential;
      };
      // set by the locale middleware (see server.ts), defaults to 'en'
      locale: string;
      // Stored in the session cookie. Travels to the client side
      session: {
        context?: SessionContext;
        rememberMe?: boolean;
        expires: number;
        // see SessionManager.getSessionStamp
        stamp?: string | null;
        oidc?: {
          state: string;
          verifier: string;
        }
      };
    }

    interface Response {
      tpl?: Record<string, unknown>;
    }

  }
}


