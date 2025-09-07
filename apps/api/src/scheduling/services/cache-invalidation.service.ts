import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// AC7: Cache invalidation strategy interfaces
export interface CacheInvalidationEvent {
  projectId: string;
  entityType: 'issue' | 'dependency' | 'computed_schedule' | 'materialized_view';
  entityId?: string;
  operation: 'create' | 'update' | 'delete' | 'bulk_update';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CacheInvalidationStrategy {
  strategy: 'immediate' | 'batched' | 'scheduled' | 'lazy';
  batchWindow?: number; // milliseconds
  maxBatchSize?: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface CacheInvalidationResult {
  success: boolean;
  invalidatedKeys: string[];
  strategy: string;
  duration: number;
  errors?: string[];
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  
  // In-memory batch queue for performance
  private invalidationQueue: Map<string, CacheInvalidationEvent[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(private prisma: PrismaService) {
    // Start periodic cleanup of expired batches
    setInterval(() => this.cleanupExpiredBatches(), 60000); // Every minute
  }

  // AC7: Main cache invalidation orchestrator
  async invalidateCache(
    event: CacheInvalidationEvent,
    strategy: CacheInvalidationStrategy = { strategy: 'immediate', priority: 'normal' }
  ): Promise<CacheInvalidationResult> {
    const startTime = Date.now();

    try {
      switch (strategy.strategy) {
        case 'immediate':
          return await this.executeImmediateInvalidation(event);
        
        case 'batched':
          return await this.enqueueBatchInvalidation(event, strategy);
        
        case 'scheduled':
          return await this.scheduleInvalidation(event, strategy);
        
        case 'lazy':
          return await this.markForLazyInvalidation(event);
        
        default:
          throw new Error(`Unknown cache invalidation strategy: ${strategy.strategy}`);
      }
    } catch (error) {
      this.logger.error(`Cache invalidation failed for project ${event.projectId}:`, error);
      
      return {
        success: false,
        invalidatedKeys: [],
        strategy: strategy.strategy,
        duration: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  // AC7: Immediate invalidation for critical changes
  private async executeImmediateInvalidation(
    event: CacheInvalidationEvent
  ): Promise<CacheInvalidationResult> {
    const startTime = Date.now();
    const invalidatedKeys: string[] = [];
    const errors: string[] = [];

    try {
      // 1. Invalidate materialized view cache
      const viewCacheKeys = this.generateMaterializedViewCacheKeys(event);
      for (const key of viewCacheKeys) {
        await this.invalidateCacheKey(key);
        invalidatedKeys.push(key);
      }

      // 2. Invalidate computed schedule cache
      const scheduleKeys = this.generateScheduleCacheKeys(event);
      for (const key of scheduleKeys) {
        await this.invalidateCacheKey(key);
        invalidatedKeys.push(key);
      }

      // 3. Invalidate related API response cache
      const apiKeys = this.generateApiCacheKeys(event);
      for (const key of apiKeys) {
        await this.invalidateCacheKey(key);
        invalidatedKeys.push(key);
      }

      // 4. Trigger materialized view refresh if needed
      if (this.requiresMaterializedViewRefresh(event)) {
        await this.triggerMaterializedViewRefresh(event.projectId, 'immediate');
      }

      // 5. Log invalidation event
      await this.logCacheInvalidation(event, 'immediate', invalidatedKeys, true);

    } catch (error) {
      errors.push(`Immediate invalidation error: ${error.message}`);
    }

    return {
      success: errors.length === 0,
      invalidatedKeys,
      strategy: 'immediate',
      duration: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // AC7: Batched invalidation for performance optimization
  private async enqueueBatchInvalidation(
    event: CacheInvalidationEvent,
    strategy: CacheInvalidationStrategy
  ): Promise<CacheInvalidationResult> {
    const batchKey = `${event.projectId}:${strategy.strategy}`;
    const batchWindow = strategy.batchWindow || 5000; // 5 seconds default
    const maxBatchSize = strategy.maxBatchSize || 50;

    // Add event to batch queue
    if (!this.invalidationQueue.has(batchKey)) {
      this.invalidationQueue.set(batchKey, []);
    }

    const queue = this.invalidationQueue.get(batchKey)!;
    queue.push(event);

    // If batch is full, process immediately
    if (queue.length >= maxBatchSize) {
      return await this.processBatch(batchKey);
    }

    // Set or reset batch timer
    if (this.batchTimers.has(batchKey)) {
      clearTimeout(this.batchTimers.get(batchKey)!);
    }

    this.batchTimers.set(batchKey, setTimeout(async () => {
      try {
        await this.processBatch(batchKey);
      } catch (error) {
        this.logger.error(`Batch processing failed for ${batchKey}:`, error);
      }
    }, batchWindow));

    return {
      success: true,
      invalidatedKeys: [],
      strategy: 'batched',
      duration: 0, // Queued, not processed yet
      errors: undefined
    };
  }

  // AC7: Process batched invalidation
  private async processBatch(batchKey: string): Promise<CacheInvalidationResult> {
    const startTime = Date.now();
    const events = this.invalidationQueue.get(batchKey) || [];
    const invalidatedKeys: string[] = [];
    const errors: string[] = [];

    if (events.length === 0) {
      return {
        success: true,
        invalidatedKeys: [],
        strategy: 'batched',
        duration: 0,
      };
    }

    try {
      // Clear queue and timer
      this.invalidationQueue.delete(batchKey);
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey)!);
        this.batchTimers.delete(batchKey);
      }

      // Group events by project and type for efficient processing
      const eventGroups = this.groupEventsByType(events);

      // Process each group
      for (const [groupKey, groupEvents] of eventGroups.entries()) {
        try {
          const groupKeys = await this.processBatchGroup(groupKey, groupEvents);
          invalidatedKeys.push(...groupKeys);
        } catch (error) {
          errors.push(`Batch group ${groupKey} failed: ${error.message}`);
        }
      }

      // Trigger batch materialized view refresh if needed
      const projectsNeedingRefresh = new Set(
        events
          .filter(e => this.requiresMaterializedViewRefresh(e))
          .map(e => e.projectId)
      );

      for (const projectId of projectsNeedingRefresh) {
        await this.triggerMaterializedViewRefresh(projectId, 'batch');
      }

      // Log batch invalidation
      await this.logBatchCacheInvalidation(events, invalidatedKeys, errors.length === 0);

    } catch (error) {
      errors.push(`Batch processing error: ${error.message}`);
    }

    return {
      success: errors.length === 0,
      invalidatedKeys,
      strategy: 'batched',
      duration: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // AC7: Scheduled invalidation for low-priority updates
  private async scheduleInvalidation(
    event: CacheInvalidationEvent,
    strategy: CacheInvalidationStrategy
  ): Promise<CacheInvalidationResult> {
    // Store scheduled invalidation in database for persistence
    await this.prisma.$executeRaw`
      INSERT INTO computed_schedule_refresh_queue (
        project_id, 
        operation_type, 
        entity_id, 
        priority,
        metadata,
        requested_at
      ) VALUES (
        ${event.projectId}::uuid,
        'cache_invalidation',
        ${event.entityId || null}::uuid,
        10, -- Low priority for scheduled
        ${JSON.stringify({
          strategy: 'scheduled',
          event_type: event.entityType,
          operation: event.operation,
          original_timestamp: event.timestamp.toISOString()
        })}::jsonb,
        NOW() + INTERVAL '5 minutes' -- Schedule for 5 minutes later
      )
    `;

    return {
      success: true,
      invalidatedKeys: [],
      strategy: 'scheduled',
      duration: 0,
    };
  }

  // AC7: Lazy invalidation - mark for invalidation on next access
  private async markForLazyInvalidation(
    event: CacheInvalidationEvent
  ): Promise<CacheInvalidationResult> {
    const cacheKeys = [
      ...this.generateMaterializedViewCacheKeys(event),
      ...this.generateScheduleCacheKeys(event),
      ...this.generateApiCacheKeys(event)
    ];

    // Mark keys as "stale" rather than deleting them
    for (const key of cacheKeys) {
      await this.markCacheKeyStale(key, event.timestamp);
    }

    return {
      success: true,
      invalidatedKeys: cacheKeys,
      strategy: 'lazy',
      duration: 0,
    };
  }

  // Helper methods for cache key generation and management

  private generateMaterializedViewCacheKeys(event: CacheInvalidationEvent): string[] {
    return [
      `materialized_view:computed_schedule_view:${event.projectId}`,
      `materialized_view:computed_schedule_view:all`,
      `view_refresh:${event.projectId}:latest`
    ];
  }

  private generateScheduleCacheKeys(event: CacheInvalidationEvent): string[] {
    const keys = [
      `computed_schedule:${event.projectId}:latest`,
      `schedule_data:${event.projectId}:gantt`,
      `critical_path:${event.projectId}:current`
    ];

    if (event.entityId) {
      keys.push(`task_schedule:${event.projectId}:${event.entityId}`);
    }

    return keys;
  }

  private generateApiCacheKeys(event: CacheInvalidationEvent): string[] {
    return [
      `api:projects:${event.projectId}:gantt`,
      `api:projects:${event.projectId}:gantt:history`,
      `api:projects:${event.projectId}:dependencies`,
      `api:projects:${event.projectId}:wbs`
    ];
  }

  private requiresMaterializedViewRefresh(event: CacheInvalidationEvent): boolean {
    return event.entityType === 'computed_schedule' && event.operation === 'update' ||
           event.entityType === 'dependency' ||
           event.entityType === 'issue' && event.metadata?.scheduleAffecting === true;
  }

  private async invalidateCacheKey(key: string): Promise<void> {
    // This would integrate with your actual caching system (Redis, etc.)
    this.logger.debug(`Invalidating cache key: ${key}`);
  }

  private async markCacheKeyStale(key: string, staleSince: Date): Promise<void> {
    // Mark key as stale for lazy invalidation
    this.logger.debug(`Marking cache key stale: ${key} since ${staleSince.toISOString()}`);
  }

  private async triggerMaterializedViewRefresh(
    projectId: string, 
    refreshType: 'immediate' | 'batch'
  ): Promise<void> {
    const priority = refreshType === 'immediate' ? 1 : 3;

    await this.prisma.$executeRaw`
      INSERT INTO computed_schedule_refresh_queue (
        project_id, operation_type, priority, metadata
      ) VALUES (
        ${projectId}::uuid, 
        'view_refresh', 
        ${priority},
        ${JSON.stringify({ refresh_type: refreshType, triggered_by: 'cache_invalidation' })}::jsonb
      )
      ON CONFLICT DO NOTHING
    `;

    // Send notification for processing
    await this.prisma.$queryRaw`
      SELECT pg_notify('computed_schedule_${refreshType}_refresh', 
        ${JSON.stringify({
          project_id: projectId,
          operation_type: 'view_refresh',
          priority: priority,
          timestamp: new Date().toISOString()
        })}
      )
    `;
  }

  private groupEventsByType(events: CacheInvalidationEvent[]): Map<string, CacheInvalidationEvent[]> {
    const groups = new Map<string, CacheInvalidationEvent[]>();

    for (const event of events) {
      const groupKey = `${event.projectId}:${event.entityType}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(event);
    }

    return groups;
  }

  private async processBatchGroup(
    groupKey: string,
    events: CacheInvalidationEvent[]
  ): Promise<string[]> {
    const invalidatedKeys: string[] = [];

    // Process all events in group efficiently
    for (const event of events) {
      const keys = [
        ...this.generateMaterializedViewCacheKeys(event),
        ...this.generateScheduleCacheKeys(event),
        ...this.generateApiCacheKeys(event)
      ];

      for (const key of keys) {
        await this.invalidateCacheKey(key);
        invalidatedKeys.push(key);
      }
    }

    return [...new Set(invalidatedKeys)]; // Deduplicate
  }

  private async logCacheInvalidation(
    event: CacheInvalidationEvent,
    strategy: string,
    invalidatedKeys: string[],
    success: boolean
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        projectId: event.projectId,
        entityType: 'cache',
        entityId: event.entityId || 'cache_system',
        action: 'invalidate',
        actor: 'system',
        metadata: {
          strategy,
          entity_type: event.entityType,
          operation: event.operation,
          invalidated_keys: invalidatedKeys,
          success,
          timestamp: event.timestamp.toISOString()
        }
      }
    });
  }

  private async logBatchCacheInvalidation(
    events: CacheInvalidationEvent[],
    invalidatedKeys: string[],
    success: boolean
  ): Promise<void> {
    if (events.length === 0) return;

    const projectIds = [...new Set(events.map(e => e.projectId))];
    
    for (const projectId of projectIds) {
      const projectEvents = events.filter(e => e.projectId === projectId);
      
      await this.prisma.activityLog.create({
        data: {
          projectId,
          entityType: 'cache',
          entityId: 'batch_system',
          action: 'batch_invalidate',
          actor: 'system',
          metadata: {
            strategy: 'batched',
            batch_size: projectEvents.length,
            event_types: [...new Set(projectEvents.map(e => e.entityType))],
            operations: [...new Set(projectEvents.map(e => e.operation))],
            invalidated_keys: invalidatedKeys,
            success,
            timestamp: new Date().toISOString()
          }
        }
      });
    }
  }

  private cleanupExpiredBatches(): void {
    // Clean up any hanging batch timers and queues
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, timer] of this.batchTimers.entries()) {
      // Check if timer has been hanging for too long (>10 minutes)
      if (this.invalidationQueue.has(key)) {
        const events = this.invalidationQueue.get(key)!;
        if (events.length > 0) {
          const oldestEvent = Math.min(...events.map(e => e.timestamp.getTime()));
          if (now - oldestEvent > 600000) { // 10 minutes
            expiredKeys.push(key);
          }
        }
      }
    }

    // Process expired batches
    for (const key of expiredKeys) {
      this.logger.warn(`Processing expired batch: ${key}`);
      this.processBatch(key).catch(error => {
        this.logger.error(`Failed to process expired batch ${key}:`, error);
      });
    }
  }
}