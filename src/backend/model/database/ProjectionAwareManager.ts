import {IObjectManager} from './IObjectManager';
import {SessionContext} from '../SessionContext';
import {DirectoryPathDTO} from '../../../common/entities/DirectoryDTO';

/**
 * Base class for managers that handle projection-aware caching.
 * Provides common functionality for managers that need to cache data
 * per user projection (like AlbumManager and PersonManager).
 */
export abstract class ProjectionAwareManager<T> implements IObjectManager {
  protected cache: Record<string, T[]> = {};

  /**
   * Get all entities for the given session. Subclasses should implement
   * the actual loading logic in loadEntities().
   */
  public async getAll(session: SessionContext): Promise<T[]> {
    const cached = this.getCachedEntities(session);
    if (cached !== null) {
      return cached;
    }

    const entities = await this.loadEntities(session);
    this.setCachedEntities(session, entities);
    return entities;
  }

  public async invalidateCache(changedDir?: DirectoryPathDTO): Promise<void> {
    await this.invalidateDBCache(changedDir);
    this.resetMemoryCache();
  }

  /**
   * Default implementation of onNewDataVersion that invalidates cache.
   * Subclasses can override for more specific behavior.
   */
  public async onNewDataVersion(changedDir?: DirectoryPathDTO): Promise<void> {
    await this.invalidateCache(changedDir);
  }

  /**
   * Reset the entire memory cache
   */
  protected resetMemoryCache(): void {
    this.cache = {};
  }

  /**
   * Abstract method that subclasses must implement to load entities
   * from the database with proper projection awareness
   */
  protected abstract loadEntities(session: SessionContext): Promise<T[]>;

  /**
   * Abstract method that subclasses must implement to invalidate
   * projection-aware cache entries in the database
   */
  protected abstract invalidateDBCache(changedDir?: DirectoryPathDTO): Promise<void>;

  /**
   * Get cached entities for the given session projection
   */
  private getCachedEntities(session: SessionContext): T[] | null {
    return this.cache[session.user.projectionKey] || null;
  }

  /**
   * Set cached entities for the given session projection
   */
  private setCachedEntities(session: SessionContext, entities: T[]): void {
    this.cache[session.user.projectionKey] = entities;
  }
}
