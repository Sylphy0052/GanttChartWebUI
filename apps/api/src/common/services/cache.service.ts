import { Injectable, Logger } from '@nestjs/common';

interface CacheItem<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  memoryUsage: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheItem<any>>();
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
    memoryUsage: 0,
  };
  
  // Default TTL: 5 minutes
  private readonly defaultTtl = 5 * 60 * 1000;
  
  // Maximum cache size to prevent memory issues
  private readonly maxSize = 1000;

  constructor() {
    // Clean up expired items every minute
    setInterval(() => this.cleanupExpiredItems(), 60000);
    
    // Log cache stats every 5 minutes
    setInterval(() => this.logCacheStats(), 5 * 60000);
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    }
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.deletes++;
      this.logger.debug(`Cache EXPIRED: ${key}`);
      return null;
    }
    
    this.stats.hits++;
    this.logger.debug(`Cache HIT: ${key}`);
    return item.data;
  }

  /**
   * Set item in cache
   */
  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs || this.defaultTtl;
    const now = Date.now();
    
    // Enforce maximum cache size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldestItems();
    }
    
    this.cache.set(key, {
      data,
      expiresAt: now + ttl,
      createdAt: now,
    });
    
    this.stats.sets++;
    this.updateCacheSize();
    this.logger.debug(`Cache SET: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Delete item from cache
   */
  async delete(key: string): Promise<void> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.updateCacheSize();
      this.logger.debug(`Cache DELETE: ${key}`);
    }
  }

  /**
   * Delete items matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      await this.delete(key);
    }
    
    this.logger.debug(`Cache DELETE PATTERN: ${pattern} (${keysToDelete.length} keys deleted)`);
    return keysToDelete.length;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.deletes += size;
    this.updateCacheSize();
    this.logger.warn(`Cache CLEAR: ${size} items removed`);
  }

  /**
   * Get or set pattern - commonly used for cache-aside pattern
   */
  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttlMs?: number
  ): Promise<T> {
    let data = await this.get<T>(key);
    
    if (data === null) {
      data = await factory();
      await this.set(key, data, ttlMs);
    }
    
    return data;
  }

  /**
   * Generate cache keys for common patterns
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateCacheSize();
    return { ...this.stats };
  }

  /**
   * Check if key exists (without affecting hit/miss stats)
   */
  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    return item !== undefined && Date.now() <= item.expiresAt;
  }

  private cleanupExpiredItems(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.stats.deletes += expiredCount;
      this.updateCacheSize();
      this.logger.debug(`Cache cleanup: ${expiredCount} expired items removed`);
    }
  }

  private evictOldestItems(): void {
    // Remove oldest 10% of items when max size reached
    const itemsToRemove = Math.max(1, Math.floor(this.maxSize * 0.1));
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.createdAt - b.createdAt)
      .slice(0, itemsToRemove);
    
    for (const [key] of sortedEntries) {
      this.cache.delete(key);
    }
    
    this.stats.deletes += itemsToRemove;
    this.updateCacheSize();
    this.logger.warn(`Cache eviction: ${itemsToRemove} oldest items removed (max size: ${this.maxSize})`);
  }

  private updateCacheSize(): void {
    this.stats.size = this.cache.size;
    // Rough memory usage estimation
    this.stats.memoryUsage = this.cache.size * 1024; // ~1KB per item estimate
  }

  private logCacheStats(): void {
    const stats = this.getStats();
    const hitRate = stats.hits + stats.misses > 0 
      ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)
      : '0';
    
    this.logger.log(
      `Cache Stats - Size: ${stats.size}, Hit Rate: ${hitRate}%, ` +
      `Hits: ${stats.hits}, Misses: ${stats.misses}, ` +
      `Sets: ${stats.sets}, Deletes: ${stats.deletes}, ` +
      `Memory: ~${(stats.memoryUsage / 1024).toFixed(1)}KB`
    );
  }
}

// Cache key generators for common data types
export class CacheKeys {
  static project(projectId: string): string {
    return `project:${projectId}`;
  }

  static projectList(userId: string): string {
    return `projects:user:${userId}`;
  }

  static projectGantt(projectId: string, options?: any): string {
    const optionsHash = options ? JSON.stringify(options) : 'default';
    return `gantt:${projectId}:${optionsHash}`;
  }

  static projectWBS(projectId: string, options?: any): string {
    const optionsHash = options ? JSON.stringify(options) : 'default';
    return `wbs:${projectId}:${optionsHash}`;
  }

  static issue(issueId: string): string {
    return `issue:${issueId}`;
  }

  static issuesList(projectId: string, query?: any): string {
    const queryHash = query ? JSON.stringify(query) : 'default';
    return `issues:${projectId}:${queryHash}`;
  }

  static schedule(projectId: string): string {
    return `schedule:${projectId}`;
  }

  static dependencies(projectId: string): string {
    return `dependencies:${projectId}`;
  }
}