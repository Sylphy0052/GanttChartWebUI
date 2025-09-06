/**
 * WBS Reordering Service
 * 
 * Enhanced service for handling WBS (Work Breakdown Structure) reordering operations
 * with bulk updates, authorization, and tree integrity validation.
 */

import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WBSHierarchyUtils } from '../common/utils/wbs-hierarchy.utils';
import { ProjectRole, hasPermission } from '../auth/types/rbac.types';

export interface BulkReorderOperation {
  issueId: string;
  oldOrderIndex: number;
  newOrderIndex: number;
  oldParentId: string | null;
  newParentId: string | null;
}

export interface ReorderValidationResult {
  isValid: boolean;
  errors: string[];
  operations: BulkReorderOperation[];
}

export interface ProjectAuthContext {
  userId: string;
  projectId: string;
  userRole: ProjectRole;
}

@Injectable()
export class WBSReorderingService {
  private wbsUtils: WBSHierarchyUtils;

  constructor(private prisma: PrismaService) {
    this.wbsUtils = new WBSHierarchyUtils(prisma);
  }

  /**
   * Enhanced bulk reordering with authorization and tree integrity validation
   * @param projectId - Project ID for authorization
   * @param operations - Array of reorder operations
   * @param authContext - User authorization context
   * @returns Number of successfully updated issues
   */
  async bulkReorderWithAuth(
    projectId: string,
    operations: BulkReorderOperation[],
    authContext: ProjectAuthContext
  ): Promise<number> {
    // 1. Validate authorization
    await this.validateReorderAuth(projectId, authContext);

    // 2. Validate operations and tree integrity
    const validation = await this.validateReorderOperations(projectId, operations);
    if (!validation.isValid) {
      throw new BadRequestException(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // 3. Execute bulk operations in transaction
    return await this.executeBulkReorder(projectId, validation.operations);
  }

  /**
   * Optimized bulk order_index updates within same parent
   * @param parentId - Parent issue ID (null for root level)  
   * @param issueOrders - Array of {issueId, orderIndex} objects
   * @param authContext - User authorization context
   * @returns Number of updated issues
   */
  async bulkUpdateOrderIndices(
    parentId: string | null,
    issueOrders: { issueId: string; orderIndex: number }[],
    authContext: ProjectAuthContext
  ): Promise<number> {
    // Get project ID from first issue for authorization
    const firstIssue = await this.prisma.issue.findFirst({
      where: { id: issueOrders[0]?.issueId, deletedAt: null },
      select: { projectId: true }
    });

    if (!firstIssue) {
      throw new NotFoundException('Issue not found');
    }

    // Validate authorization
    await this.validateReorderAuth(firstIssue.projectId, authContext);

    // Validate all issues belong to the same parent and project
    const issues = await this.prisma.issue.findMany({
      where: {
        id: { in: issueOrders.map(order => order.issueId) },
        parentIssueId: parentId,
        projectId: firstIssue.projectId,
        deletedAt: null
      }
    });

    if (issues.length !== issueOrders.length) {
      throw new BadRequestException('One or more issues not found or not in the same parent');
    }

    // Execute optimized bulk update in single transaction
    return await this.prisma.$transaction(async (tx) => {
      // Use single SQL UPDATE with CASE for better performance
      const updatePromises = issueOrders.map(({ issueId, orderIndex }) =>
        tx.issue.update({
          where: { id: issueId },
          data: { 
            orderIndex,
            version: { increment: 1 }
          }
        })
      );

      await Promise.all(updatePromises);
      return updatePromises.length;
    });
  }

  /**
   * Handle parent change with tree integrity validation
   * @param issueId - Issue to move
   * @param newParentId - New parent ID (null for root)
   * @param authContext - User authorization context  
   * @returns Updated issue details
   */
  async changeParentWithIntegrityCheck(
    issueId: string,
    newParentId: string | null,
    authContext: ProjectAuthContext
  ): Promise<{ issueId: string; level: number; newOrderIndex: number }> {
    // Get current issue
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, deletedAt: null }
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    // Validate authorization
    await this.validateReorderAuth(issue.projectId, authContext);

    // Validate tree integrity
    if (newParentId) {
      const newParent = await this.prisma.issue.findFirst({
        where: {
          id: newParentId,
          projectId: issue.projectId,
          deletedAt: null
        }
      });

      if (!newParent) {
        throw new BadRequestException('New parent issue not found');
      }

      // Check hierarchy constraints
      const isValidMove = await this.wbsUtils.validateHierarchyDepth(issueId, newParentId, 5);
      if (!isValidMove) {
        throw new BadRequestException('Moving issue would exceed maximum hierarchy depth or create circular dependency');
      }
    }

    // Get next order index for new parent level
    const newOrderIndex = await this.wbsUtils.getNextOrderIndex(
      issue.projectId,
      newParentId
    );

    // Execute update in transaction
    const updatedIssue = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id: issueId },
        data: {
          parentIssueId: newParentId,
          orderIndex: newOrderIndex,
          version: issue.version + 1
        }
      });

      return updated;
    });

    return {
      issueId: updatedIssue.id,
      level: await this.wbsUtils.calculateLevel(updatedIssue.id),
      newOrderIndex: updatedIssue.orderIndex
    };
  }

  /**
   * Validate user authorization for reordering operations
   */
  private async validateReorderAuth(
    projectId: string,
    authContext: ProjectAuthContext
  ): Promise<void> {
    // Verify project exists and user has access
    const projectMember = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: authContext.userId
      }
    });

    if (!projectMember) {
      throw new ForbiddenException('User does not have access to this project');
    }

    // Check if user has permission to edit issues
    const userRole = projectMember.role as ProjectRole;
    const canEditIssues = hasPermission(userRole, 'editAllIssues') || 
                          hasPermission(userRole, 'editAssignedIssues');

    if (!canEditIssues) {
      throw new ForbiddenException('Insufficient permissions to reorder issues');
    }
  }

  /**
   * Validate reorder operations and check tree integrity
   */
  private async validateReorderOperations(
    projectId: string,
    operations: BulkReorderOperation[]
  ): Promise<ReorderValidationResult> {
    const errors: string[] = [];
    const validOperations: BulkReorderOperation[] = [];

    for (const operation of operations) {
      const { issueId, newParentId } = operation;

      // Check if issue exists
      const issue = await this.prisma.issue.findFirst({
        where: {
          id: issueId,
          projectId,
          deletedAt: null
        }
      });

      if (!issue) {
        errors.push(`Issue ${issueId} not found`);
        continue;
      }

      // Validate parent change if applicable
      if (operation.newParentId !== operation.oldParentId) {
        if (newParentId) {
          const isValidMove = await this.wbsUtils.validateHierarchyDepth(issueId, newParentId, 5);
          if (!isValidMove) {
            errors.push(`Moving issue ${issueId} would create circular dependency or exceed depth limit`);
            continue;
          }
        }
      }

      validOperations.push(operation);
    }

    return {
      isValid: errors.length === 0,
      errors,
      operations: validOperations
    };
  }

  /**
   * Execute bulk reorder operations in optimized transaction
   */
  private async executeBulkReorder(
    projectId: string,
    operations: BulkReorderOperation[]
  ): Promise<number> {
    return await this.prisma.$transaction(async (tx) => {
      let updateCount = 0;

      // Group operations by type for optimization
      const sameParentOps = operations.filter(op => op.oldParentId === op.newParentId);
      const parentChangeOps = operations.filter(op => op.oldParentId !== op.newParentId);

      // Handle same-parent reordering (bulk update)
      if (sameParentOps.length > 0) {
        const updatePromises = sameParentOps.map(op =>
          tx.issue.update({
            where: { id: op.issueId },
            data: { 
              orderIndex: op.newOrderIndex,
              version: { increment: 1 }
            }
          })
        );
        await Promise.all(updatePromises);
        updateCount += sameParentOps.length;
      }

      // Handle parent changes (individual updates with order index recalculation)
      for (const op of parentChangeOps) {
        const newOrderIndex = await this.wbsUtils.getNextOrderIndex(
          projectId,
          op.newParentId
        );

        await tx.issue.update({
          where: { id: op.issueId },
          data: {
            parentIssueId: op.newParentId,
            orderIndex: newOrderIndex,
            version: { increment: 1 }
          }
        });
        updateCount++;
      }

      return updateCount;
    });
  }
}