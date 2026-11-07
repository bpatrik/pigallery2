import {Request} from 'express';
import {SessionContext} from '../model/SessionContext';

export class RequestSession {
  /**
   * The context of the logged-in session.
   * AuthenticationMWs.authenticate sets it, so a route that authenticates always has it.
   */
  public static getContext(req: Request): SessionContext {
    if (!req.session.context) {
      throw new Error('No session context, the request is not authenticated');
    }
    return req.session.context;
  }
}
