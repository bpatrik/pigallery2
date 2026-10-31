import * as crypto from 'crypto';
import {SessionUser, SessionContext} from '../SessionContext';
import {DirectoryAccess, DirectoryFilter} from '../DirectoryAccess';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';
import {Config} from '../../../common/config/private/Config';
import {ANDSearchQuery, DirectorySearch, SearchQueryDTO, SearchQueryTypes} from '../../../common/entities/SearchQueryDTO';
import {SharingEntity} from './enitites/SharingEntity';
import {ObjectManagers} from '../ObjectManagers';
import {Logger} from '../../Logger';
import {UserRoles} from '../../../common/entities/UserDTO';
import {UserEntity} from './enitites/UserEntity';
import {SQLConnection} from './SQLConnection';

const LOG_TAG = '[SessionManager]';

export class SessionManager {

  public static readonly NO_PROJECTION_KEY = crypto.createHash('md5').update('No Key').digest('hex');

  // Session stamps by user id or sharing key (see getSessionStamp), so they do not need a DB query per request.
  private stamps = new Map<string, { stamp: string, expires?: number }>();
  private stampGeneration = 0;

  private static andQueries(...queries: SearchQueryDTO[]): SearchQueryDTO {
    const list = queries.filter(q => !SearchQueryUtils.isQueryEmpty(q));
    if (list.length === 0) {
      return null;
    }
    if (list.length === 1) {
      return list[0];
    }
    return {
      type: SearchQueryTypes.AND,
      list
    } as ANDSearchQuery;
  }

  /**
   * Creates the user that is used during a sharing session.
   * It inherits the restrictions of the sharing creator.
   */
  public createSharingUser(sharing: SharingEntity): SessionUser {
    // without any of these, the sharing would show everything the creator can see
    if (SearchQueryUtils.isQueryEmpty(sharing.searchQuery) && !sharing.directoryQuery) {
      throw new Error('Invalid sharing: either searchQuery or directoryQuery needs to be set');
    }
    const creatorLists = this.getDirectoryListsForUser(sharing.creator);
    return {
      name: 'Guest',
      role: UserRoles.LimitedGuest,
      usedSharingKey: sharing.sharingKey,
      overrideAllowBlockList: true,
      allowQuery: SessionManager.andQueries(this.getMediaQueryForUser(sharing.creator), sharing.searchQuery ?? null),
      allowDirectoryList: creatorLists.allow,
      blockDirectoryList: creatorLists.block,
      // directories that are available through the sharing, see getDirectoryAccessForUser
      sharingDirectoryQuery: sharing.directoryQuery ?? null
    } as SessionUser;
  }

  /**
   * Signature of the DB row a session is based on: the user, or the sharing (with its creator).
   * Sessions are stored in the cookie, a session is only valid while its stamp is unchanged,
   * so deleting or changing the user or sharing ends it. Null if the row does not exist or the sharing expired.
   */
  public async getSessionStamp(user: SessionUser): Promise<string> {
    const key = user.usedSharingKey ? 'sharing:' + user.usedSharingKey : 'user:' + user.id;
    let entry = this.stamps.get(key);
    if (!entry) {
      const generation = this.stampGeneration;
      const row = await this.loadSessionRow(user);
      entry = {
        stamp: row ? crypto.createHmac('sha256', Config.Server.sessionSecret.join(''))
          .update(JSON.stringify(row)).digest('hex') : null,
        expires: (row as SharingEntity)?.expires
      };
      // do not cache it if the row changed during the query
      if (generation === this.stampGeneration) {
        this.stamps.set(key, entry);
      }
    }
    return entry.expires < Date.now() ? null : entry.stamp;
  }

  /**
   * Needs to be called after every user or sharing change.
   */
  public invalidateSessionCache(): void {
    this.stampGeneration++;
    this.stamps.clear();
  }

  private async loadSessionRow(user: SessionUser): Promise<UserEntity | SharingEntity> {
    const connection = await SQLConnection.getConnection();
    if (user.usedSharingKey) {
      // not using SharingManager.findOne, that also deletes the expired sharings
      return connection.getRepository(SharingEntity)
        .createQueryBuilder('share')
        .leftJoinAndSelect('share.creator', 'creator')
        .where('share.sharingKey = :sharingKey', {sharingKey: user.usedSharingKey})
        .getOne();
    }
    if (typeof user.id !== 'number') {
      return null;
    }
    return connection.getRepository(UserEntity).findOneBy({id: user.id});
  }

  /**
   * Returns with the final projection query (media and directory allow/block lists) of a sharing.
   */
  public buildAllowListForSharing(sharing: SharingEntity): SearchQueryDTO {
    return this.getQueryForUser(this.createSharingUser(sharing));
  }

  public createProjectionKey(q: SearchQueryDTO) {
    const canonical = SearchQueryUtils.stringifyForComparison(q);
    return crypto.createHash('md5').update(canonical).digest('hex');
  }

  public async buildContext(user: SessionUser): Promise<SessionContext> {
    const context = new SessionContext();
    context.user = user;
    context.user.projectionKey = SessionManager.NO_PROJECTION_KEY;
    const finalQuery = this.getQueryForUser(user);

    if (finalQuery) {
      const sm = ObjectManagers.getInstance().SearchManager;
      // Build the Brackets-based query
      context.projectionQuery = await sm.prepareAndBuildWhereQuery(finalQuery);
      context.hasDirectoryProjection = sm.hasDirectoryQuery(finalQuery);
      context.user.projectionKey = this.createProjectionKey(finalQuery);
      if (SearchQueryUtils.isQueryEmpty(finalQuery)) {
        Logger.silly(LOG_TAG, 'Empty Projection query.');
      } else {
        Logger.silly(LOG_TAG, 'Projection query: ' + JSON.stringify(finalQuery));
      }
    }

    const dirAccess = this.getDirectoryAccessForUser(user);
    const access: Partial<DirectoryAccess> = {};
    if (dirAccess.allowLists.length > 0) {
      access.allowLists = dirAccess.allowLists;
      access.allowQuery = await this.buildDirectoryFilter(SessionManager.andQueries(
        ...dirAccess.allowLists.map(l => SearchQueryUtils.directoryListToQuery(l))));
    }
    if (user.usedSharingKey && !user.sharingDirectoryQuery) {
      access.byPhotos = true;
    }
    if (dirAccess.blockList.length > 0) {
      access.blockList = dirAccess.blockList;
      access.notBlockedQuery = await this.buildDirectoryFilter(
        SearchQueryUtils.negate(SearchQueryUtils.directoryListToQuery(dirAccess.blockList)));
    }
    context.directoryAccess = new DirectoryAccess(context, access);
    return context;
  }

  async getAvailableUserSessions(): Promise<SessionContext[]> {
    // If authentication is not required, expose the unauthenticated session only
    if (Config.Users.authenticationRequired === false) {
      const user = ObjectManagers.getInstance().UserManager.getUnAuthenticatedUser();
      const ctx = await this.buildContext(user as unknown as SessionUser);
      return [ctx];
    }

    // List all users and build a session context for each
    const users = await ObjectManagers.getInstance().UserManager.find({} as any);
    const sessions: SessionContext[] = [];
    for (const u of users as unknown as SessionUser[]) {
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

  private async buildDirectoryFilter(query: SearchQueryDTO): Promise<DirectoryFilter> {
    const sm = ObjectManagers.getInstance().SearchManager;
    return {
      directory: await sm.prepareAndBuildWhereQuery(query, true),
      directories: await sm.prepareAndBuildWhereQuery(query, true, {directory: 'directories'})
    };
  }

  /**
   * Returns the media and the directory allow/block lists combined.
   * Media that is in a not available directory is also not available.
   */
  private getQueryForUser(user: SessionUser): SearchQueryDTO {
    const lists = this.getDirectoryListsForUser(user);
    // directoryListToQuery throws on invalid entries.
    // Fail closed: a misconfigured directory list should not silently expose everything
    const block = SearchQueryUtils.directoryListToQuery(lists.block);
    return SessionManager.andQueries(
      this.getMediaQueryForUser(user),
      SearchQueryUtils.directoryListToQuery(lists.allow),
      user.usedSharingKey ? SearchQueryUtils.directoryListToQuery(user.sharingDirectoryQuery ? [user.sharingDirectoryQuery] : []) : null,
      block ? SearchQueryUtils.negate(block) : null
    );
  }

  private getMediaQueryForUser(user: SessionUser): SearchQueryDTO {
    const blockQuery = user.overrideAllowBlockList ? user.blockQuery : Config.Users.blockQuery;
    const allowQuery = user.overrideAllowBlockList ? user.allowQuery : Config.Users.allowQuery;

    return SessionManager.andQueries(
      allowQuery,
      !SearchQueryUtils.isQueryEmpty(blockQuery) ? SearchQueryUtils.negate(blockQuery) : null
    );
  }

  /**
   * Returns the user's own lists if they are overridden, otherwise the global ones from the config.
   */
  private getDirectoryListsForUser(user: SessionUser): { allow: DirectorySearch[], block: DirectorySearch[] } {
    // plain copies, so config objects do not end up in the session
    const copy = (list: DirectorySearch[]): DirectorySearch[] =>
      (list || []).map(d => ({type: d.type, value: d.value, matchType: d.matchType, negate: d.negate}));
    return {
      allow: copy(user.overrideAllowBlockList ? user.allowDirectoryList : Config.Users.allowDirectoryList),
      block: copy(user.overrideAllowBlockList ? user.blockDirectoryList : Config.Users.blockDirectoryList)
    };
  }

  /**
   * A directory is available if it matches every allow list and none of the block list entries.
   * The directory query of a sharing works as an extra allow list (on top of the creator's lists).
   */
  private getDirectoryAccessForUser(user: SessionUser): { allowLists: DirectorySearch[][], blockList: DirectorySearch[] } {
    const lists = this.getDirectoryListsForUser(user);
    SearchQueryUtils.validateDirectoryList(lists.allow, 'Directory allow list');
    SearchQueryUtils.validateDirectoryList(lists.block, 'Directory block list');
    const allowLists: DirectorySearch[][] = [];
    if (lists.allow.length > 0) {
      allowLists.push(lists.allow);
    }
    if (user.usedSharingKey && user.sharingDirectoryQuery) {
      SearchQueryUtils.validateDirectorySearch(user.sharingDirectoryQuery, 'Sharing directory query');
      allowLists.push([user.sharingDirectoryQuery]);
    }
    return {allowLists, blockList: lists.block};
  }
}
