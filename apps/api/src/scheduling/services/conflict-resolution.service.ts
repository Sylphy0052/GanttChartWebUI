import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictDetectionService, DetectedConflict, ConflictPattern } from './conflict-detection.service';
import { ConflictResolutionRequest, ConflictResolutionResponse, ConflictResolutionStrategy, DateResolutionRule, ProgressResolutionRule } from '../dto/conflict-resolution.dto';

export interface ResolutionResult {
  success: boolean;
  resolvedConflictId: string;
  appliedStrategy: ConflictResolutionStrategy;
  finalValues: any;
  rollbackData?: any;
  warnings: string[];
}

export interface BulkResolutionOptions {
  strategy: 'first-win' | 'last-win' | 'manual' | 'interactive';
  autoResolveLevel: 'none' | 'warnings' | 'all';
  preserveUserChanges: boolean;
  createBackup: boolean;
}

@Injectable()
export class ConflictResolutionService {
  constructor(
    private prisma: PrismaService,
    private conflictDetectionService: ConflictDetectionService
  ) {}

  /**
   * Resolve a single conflict
   */
  async resolveConflict(
    projectId: string,
    request: ConflictResolutionRequest,
    userId: string
  ): Promise<ConflictResolutionResponse> {
    // Get the conflict details
    const context = {
      userId,
      timestamp: new Date(),
      operation: 'update' as const,
      entityType: 'issue' as const,
      entityId: request.conflictId.split('_')[1] || request.conflictId,
      projectId
    };

    // Parse conflict ID to get entity information
    const conflictParts = request.conflictId.split('_');
    if (conflictParts.length < 2) {
      throw new BadRequestException('Invalid conflict ID format');
    }

    const [pattern, entityId] = conflictParts;
    const entityType = this.inferEntityType(pattern);

    try {
      let resolutionResult: ResolutionResult;

      switch (request.resolution.strategy) {
        case ConflictResolutionStrategy.CURRENT:
          resolutionResult = await this.applyCurrentStrategy(entityType, entityId, request, userId);
          break;
          
        case ConflictResolutionStrategy.INCOMING:
          resolutionResult = await this.applyIncomingStrategy(entityType, entityId, request, userId);
          break;
          
        case ConflictResolutionStrategy.MANUAL:
          resolutionResult = await this.applyManualStrategy(entityType, entityId, request, userId);
          break;
          
        case ConflictResolutionStrategy.MERGE:
          resolutionResult = await this.applyMergeStrategy(entityType, entityId, request, userId);
          break;
          
        default:
          throw new BadRequestException(`Unsupported resolution strategy: ${request.resolution.strategy}`);
      }

      // Log the resolution
      await this.logConflictResolution(projectId, request.conflictId, resolutionResult, userId);

      // Check for remaining conflicts
      const remainingConflicts = await this.checkRemainingConflicts(projectId, entityId, entityType);

      return {
        success: resolutionResult.success,
        resolvedConflict: {
          conflictId: request.conflictId,
          appliedStrategy: resolutionResult.appliedStrategy,
          finalValues: resolutionResult.finalValues
        },
        remainingConflicts: remainingConflicts.length
      };
    } catch (error) {
      throw new ConflictException(`Failed to resolve conflict: ${error.message}`);
    }
  }

  /**
   * Bulk conflict resolution for multiple conflicts
   */
  async resolveBulkConflicts(
    projectId: string,
    conflicts: DetectedConflict[],
    options: BulkResolutionOptions,
    userId: string
  ): Promise<Array<ConflictResolutionResponse>> {
    const results: ConflictResolutionResponse[] = [];
    const backupData = options.createBackup ? await this.createProjectBackup(projectId) : null;

    try {
      for (const conflict of conflicts) {
        if (options.autoResolveLevel === 'none') {
          continue; // Skip auto-resolution
        }

        if (options.autoResolveLevel === 'warnings' && conflict.severity === 'error') {
          continue; // Skip errors in warning-only mode
        }

        const strategy = this.determineAutoStrategy(conflict, options.strategy);
        const request: ConflictResolutionRequest = {
          conflictId: conflict.id,
          resolution: {
            strategy,
            manualValues: conflict.attemptedData,
            mergeRules: options.preserveUserChanges ? {
              startDate: DateResolutionRule.INCOMING,
              endDate: DateResolutionRule.INCOMING,
              progress: ProgressResolutionRule.MAX
            } : undefined
          }
        };

        try {
          const result = await this.resolveConflict(projectId, request, userId);
          results.push(result);
        } catch (error) {
          // Continue with other conflicts if one fails
          results.push({
            success: false,
            resolvedConflict: {
              conflictId: conflict.id,
              appliedStrategy: strategy,
              finalValues: null
            },
            remainingConflicts: 0
          });
        }
      }

      return results;
    } catch (error) {
      // If bulk resolution fails, restore backup if available
      if (backupData && options.createBackup) {
        await this.restoreProjectBackup(projectId, backupData);
      }
      throw error;
    }
  }

  /**
   * Get conflict resolution recommendations
   */
  async getResolutionRecommendations(
    conflictId: string,
    projectId: string
  ): Promise<{
    recommendedStrategy: ConflictResolutionStrategy;
    confidence: number;
    reasons: string[];
    alternatives: Array<{
      strategy: ConflictResolutionStrategy;
      confidence: number;
      pros: string[];
      cons: string[];
    }>;
  }> {
    const conflictParts = conflictId.split('_');
    const pattern = conflictParts[0] as ConflictPattern;
    
    // Base recommendations based on conflict pattern
    let recommendedStrategy = ConflictResolutionStrategy.MANUAL;
    let confidence = 0.5;
    const reasons: string[] = [];

    switch (pattern) {
      case ConflictPattern.UPDATE_CONFLICT:
        recommendedStrategy = ConflictResolutionStrategy.MERGE;
        confidence = 0.8;
        reasons.push('Update conflicts often benefit from merging changes');
        break;
        
      case ConflictPattern.DELETE_CONFLICT:
        recommendedStrategy = ConflictResolutionStrategy.CURRENT;
        confidence = 0.9;
        reasons.push('Deleted entities should preserve current state');
        break;
        
      case ConflictPattern.SCHEDULE_CONFLICT:
        recommendedStrategy = ConflictResolutionStrategy.INCOMING;
        confidence = 0.7;
        reasons.push('Schedule conflicts usually favor new scheduling data');
        break;
        
      case ConflictPattern.DEPENDENCY_CONFLICT:
        recommendedStrategy = ConflictResolutionStrategy.MANUAL;
        confidence = 0.6;
        reasons.push('Dependency conflicts require careful manual review');
        break;
        
      case ConflictPattern.RESOURCE_CONFLICT:
        recommendedStrategy = ConflictResolutionStrategy.MERGE;
        confidence = 0.7;
        reasons.push('Resource conflicts can often be merged with redistribution');
        break;
    }

    const alternatives = [
      {
        strategy: ConflictResolutionStrategy.CURRENT,
        confidence: 0.3,
        pros: ['Preserves existing data', 'No risk of data loss'],
        cons: ['May ignore important updates', 'Could miss improvements']
      },
      {
        strategy: ConflictResolutionStrategy.INCOMING,
        confidence: 0.4,
        pros: ['Applies latest changes', 'Reflects current intent'],
        cons: ['May overwrite valuable data', 'Could lose important context']
      },
      {
        strategy: ConflictResolutionStrategy.MERGE,
        confidence: 0.6,
        pros: ['Combines best of both', 'Minimizes data loss'],
        cons: ['May create inconsistencies', 'Requires careful validation']
      }
    ].filter(alt => alt.strategy !== recommendedStrategy);

    return {
      recommendedStrategy,
      confidence,
      reasons,
      alternatives
    };
  }

  // Private resolution strategy implementations

  private async applyCurrentStrategy(
    entityType: string,
    entityId: string,
    request: ConflictResolutionRequest,
    userId: string
  ): Promise<ResolutionResult> {
    // Keep current values - essentially a no-op for data, but we log the decision
    const currentEntity = await this.getEntity(entityType, entityId);
    
    return {
      success: true,
      resolvedConflictId: request.conflictId,
      appliedStrategy: ConflictResolutionStrategy.CURRENT,
      finalValues: currentEntity,
      warnings: ['Current values preserved - no changes applied']
    };
  }

  private async applyIncomingStrategy(
    entityType: string,
    entityId: string,
    request: ConflictResolutionRequest,
    userId: string
  ): Promise<ResolutionResult> {
    if (!request.resolution.manualValues) {
      throw new BadRequestException('Manual values required for incoming strategy');
    }

    const rollbackData = await this.getEntity(entityType, entityId);
    const updatedEntity = await this.updateEntity(
      entityType, 
      entityId, 
      request.resolution.manualValues,
      userId
    );

    return {
      success: true,
      resolvedConflictId: request.conflictId,
      appliedStrategy: ConflictResolutionStrategy.INCOMING,
      finalValues: updatedEntity,
      rollbackData,
      warnings: []
    };
  }

  private async applyManualStrategy(
    entityType: string,
    entityId: string,
    request: ConflictResolutionRequest,
    userId: string
  ): Promise<ResolutionResult> {
    if (!request.resolution.manualValues) {
      throw new BadRequestException('Manual values required for manual strategy');
    }

    const rollbackData = await this.getEntity(entityType, entityId);
    const updatedEntity = await this.updateEntity(
      entityType,
      entityId,
      request.resolution.manualValues,
      userId
    );

    return {
      success: true,
      resolvedConflictId: request.conflictId,
      appliedStrategy: ConflictResolutionStrategy.MANUAL,
      finalValues: updatedEntity,
      rollbackData,
      warnings: []
    };
  }

  private async applyMergeStrategy(
    entityType: string,
    entityId: string,
    request: ConflictResolutionRequest,
    userId: string
  ): Promise<ResolutionResult> {
    const current = await this.getEntity(entityType, entityId);
    const incoming = request.resolution.manualValues;
    const mergeRules = request.resolution.mergeRules;

    if (!incoming || !mergeRules) {
      throw new BadRequestException('Incoming values and merge rules required for merge strategy');
    }

    const merged = this.performMerge(current, incoming, mergeRules);
    const updatedEntity = await this.updateEntity(entityType, entityId, merged, userId);

    return {
      success: true,
      resolvedConflictId: request.conflictId,
      appliedStrategy: ConflictResolutionStrategy.MERGE,
      finalValues: updatedEntity,
      rollbackData: current,
      warnings: this.generateMergeWarnings(current, incoming, merged)
    };
  }

  private performMerge(current: any, incoming: any, mergeRules: any): any {
    const merged = { ...current };

    // Apply merge rules for specific fields
    if (mergeRules.startDate && incoming.startDate !== undefined) {
      merged.startDate = this.resolveDateField(
        current.startDate, 
        incoming.startDate, 
        mergeRules.startDate
      );
    }

    if (mergeRules.endDate && incoming.endDate !== undefined) {
      merged.endDate = this.resolveDateField(
        current.endDate, 
        incoming.endDate, 
        mergeRules.endDate
      );
    }

    if (mergeRules.progress && incoming.progress !== undefined) {
      merged.progress = this.resolveProgressField(
        current.progress,
        incoming.progress,
        mergeRules.progress
      );
    }

    // For other fields, prefer incoming values
    Object.keys(incoming).forEach(key => {
      if (!mergeRules[key] && incoming[key] !== undefined) {
        merged[key] = incoming[key];
      }
    });

    return merged;
  }

  private resolveDateField(current: Date | null, incoming: Date, rule: string): Date {
    if (!current) return incoming;
    
    const currentTime = current.getTime();
    const incomingTime = incoming.getTime();

    switch (rule) {
      case 'current': return current;
      case 'incoming': return incoming;
      case 'earliest': return currentTime < incomingTime ? current : incoming;
      case 'latest': return currentTime > incomingTime ? current : incoming;
      default: return incoming;
    }
  }

  private resolveProgressField(current: number, incoming: number, rule: string): number {
    switch (rule) {
      case 'current': return current;
      case 'incoming': return incoming;
      case 'max': return Math.max(current, incoming);
      case 'avg': return Math.round((current + incoming) / 2);
      default: return incoming;
    }
  }

  private generateMergeWarnings(current: any, incoming: any, merged: any): string[] {
    const warnings: string[] = [];
    
    const significantFields = ['startDate', 'endDate', 'progress', 'assigneeId'];
    significantFields.forEach(field => {
      if (current[field] !== merged[field] && incoming[field] !== merged[field]) {
        warnings.push(`Field '${field}' was merged with custom logic`);
      }
    });

    return warnings;
  }

  // Helper methods

  private inferEntityType(pattern: string): 'issue' | 'dependency' | 'project' {
    if (pattern.includes('SCHEDULE') || pattern.includes('UPDATE')) {
      return 'issue';
    } else if (pattern.includes('DEPENDENCY')) {
      return 'dependency';
    }
    return 'project';
  }

  private determineAutoStrategy(
    conflict: DetectedConflict, 
    preferredStrategy: string
  ): ConflictResolutionStrategy {
    switch (preferredStrategy) {
      case 'first-win': return ConflictResolutionStrategy.CURRENT;
      case 'last-win': return ConflictResolutionStrategy.INCOMING;
      case 'manual': return ConflictResolutionStrategy.MANUAL;
      default: 
        // Intelligent auto-selection based on conflict type
        if (conflict.severity === 'warning') {
          return ConflictResolutionStrategy.MERGE;
        }
        return ConflictResolutionStrategy.MANUAL;
    }
  }

  private async getEntity(entityType: string, entityId: string): Promise<any> {
    switch (entityType) {
      case 'issue':
        return this.prisma.issue.findUnique({ where: { id: entityId } });
      case 'dependency':
        return this.prisma.dependency.findUnique({ where: { id: entityId } });
      case 'project':
        return this.prisma.project.findUnique({ where: { id: entityId } });
      default:
        throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }
  }

  private async updateEntity(
    entityType: string, 
    entityId: string, 
    data: any,
    userId: string
  ): Promise<any> {
    const updateData = { ...data };
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    switch (entityType) {
      case 'issue':
        return this.prisma.issue.update({
          where: { id: entityId },
          data: { ...updateData, version: { increment: 1 } }
        });
      case 'dependency':
        return this.prisma.dependency.update({
          where: { id: entityId },
          data: updateData
        });
      case 'project':
        return this.prisma.project.update({
          where: { id: entityId },
          data: updateData
        });
      default:
        throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }
  }

  private async checkRemainingConflicts(
    projectId: string,
    entityId: string,
    entityType: string
  ): Promise<DetectedConflict[]> {
    const context = {
      userId: 'system',
      timestamp: new Date(),
      operation: 'update' as const,
      entityType: entityType as any,
      entityId,
      projectId
    };

    return this.conflictDetectionService.checkDataIntegrity(projectId, context);
  }

  private async logConflictResolution(
    projectId: string,
    conflictId: string,
    result: ResolutionResult,
    userId: string
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        projectId,
        entityType: 'issue',
        entityId: conflictId,
        action: 'conflict_resolution',
        actor: userId,
        metadata: {
          conflictId,
          strategy: result.appliedStrategy,
          success: result.success,
          warnings: result.warnings
        }
      }
    });
  }

  private async createProjectBackup(projectId: string): Promise<any> {
    // Simple backup - in production, this would be more sophisticated
    const projectData = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        issues: { where: { deletedAt: null } },
        dependencies: true
      }
    });

    return {
      timestamp: new Date(),
      projectData
    };
  }

  private async restoreProjectBackup(projectId: string, backupData: any): Promise<void> {
    // Simplified restore - in production, this would be transactional
    console.warn(`Backup restore triggered for project ${projectId} at ${backupData.timestamp}`);
    // Implementation would restore the backed up data
  }
}