import * as crypto from 'crypto';
import {ContextUser, SessionContext} from '../SessionContext';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';
import {Config} from '../../../common/config/private/Config';
import {ANDSearchQuery, SearchQueryDTO, SearchQueryTypes} from '../../../common/entities/SearchQueryDTO';
import {SharingEntity} from './enitites/SharingEntity';
import {ObjectManagers} from '../ObjectManagers';
import {Logger} from '../../Logger';

const LOG_TAG = '[SessionManager]';

export class SessionManager {

  public static readonly NO_PROJECTION_KEY = crypto.createHash('md5').update('No Key').digest('hex');

  public buildAllowListForSharing(sharing: SharingEntity): SearchQueryDTO {
    const creatorQuery = this.getQueryForUser(sharing.creator);
    let finalQuery = sharing.searchQuery;
    if (creatorQuery) {
      finalQuery = {
        type: SearchQueryTypes.AND,
        list: [
          creatorQuery,
          sharing.searchQuery
        ]
      } as ANDSearchQuery;
    }
    return finalQuery;
  }

  public createProjectionKey(q: SearchQueryDTO) {
    const canonical = SearchQueryUtils.stringifyForComparison(q);
    return crypto.createHash('md5').update(canonical).digest('hex');
  }

  public async buildContext(user: ContextUser): Promise<SessionContext> {
    const context = new SessionContext();
    context.user = user;
    context.user.projectionKey = SessionManager.NO_PROJECTION_KEY;
    let finalQuery = this.getQueryForUser(user);

    if (finalQuery) {
      // Build the Brackets-based query
      context.projectionQuery = await ObjectManagers.getInstance().SearchManager.prepareAndBuildWhereQuery(finalQuery, false, {}, true);
      context.hasDirectoryProjection = ObjectManagers.getInstance().SearchManager.hasDirectoryQuery(finalQuery);
      if (context.hasDirectoryProjection) {
        context.projectionQueryForSubDir = await ObjectManagers.getInstance().SearchManager.prepareAndBuildWhereQuery(finalQuery, true, {directory: 'directories'}, true);
      }
      context.user.projectionKey = this.createProjectionKey(finalQuery);
      if (SearchQueryUtils.isQueryEmpty(finalQuery)) {
        Logger.silly(LOG_TAG, 'Empty Projection query.');
      } else {
        Logger.silly(LOG_TAG, 'Projection query: ' + JSON.stringify(finalQuery));
      }
    }
    return context;
  }

  async getAvailableUserSessions(): Promise<SessionContext[]> {
    // If authentication is not required, expose the unauthenticated session only
    if (Config.Users.authenticationRequired === false) {
      const user = ObjectManagers.getInstance().UserManager.getUnAuthenticatedUser();
      const ctx = await this.buildContext(user as unknown as ContextUser);
      return [ctx];
    }

    // List all users and build a session context for each
    const users = await ObjectManagers.getInstance().UserManager.find({} as any);
    const sessions: SessionContext[] = [];
    for (const u of users as unknown as ContextUser[]) {
      try {
        const ctx = await this.buildContext(u);
        sessions.push(ctx);
      } catch (e) {
        // Log and continue on individual user context build failure to ensure we return other sessions
        Logger.warn(LOG_TAG, 'Failed to build session context for user id=' + (u as any)?.id + ': ' + (e as Error)?.message);
      }
    }
    return sessions;
  }

  private getQueryForUser(user: ContextUser): SearchQueryDTO {
    let blockQuery = user.overrideAllowBlockList ? user.blockQuery : Config.Users.blockQuery;
    const allowQuery = user.overrideAllowBlockList ? user.allowQuery : Config.Users.allowQuery;

    if (SearchQueryUtils.isQueryEmpty(allowQuery) && SearchQueryUtils.isQueryEmpty(blockQuery)) {
      return null;
    }

    if (!SearchQueryUtils.isQueryEmpty(blockQuery)) {
      blockQuery = SearchQueryUtils.negate(blockQuery);
    }
    let query = !SearchQueryUtils.isQueryEmpty(allowQuery) ? allowQuery : blockQuery;
    if (!SearchQueryUtils.isQueryEmpty(allowQuery) && !SearchQueryUtils.isQueryEmpty(blockQuery)) {
      query = {
        type: SearchQueryTypes.AND,
        list: [
          allowQuery,
          blockQuery
        ]
      } as ANDSearchQuery;
    }
    return query;

  }
}
