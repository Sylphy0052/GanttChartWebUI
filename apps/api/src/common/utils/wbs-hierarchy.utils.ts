/**
 * WBS Hierarchical Utility Functions
 * 
 * This module provides utility functions for managing Work Breakdown Structure (WBS) 
 * hierarchical data operations on the Issue model with the new orderIndex field.
 */

import { PrismaClient, Issue } from '@prisma/client';

export interface IssueHierarchy extends Issue {
  children?: IssueHierarchy[];
  level?: number;
}

export interface HierarchyOptions {
  maxDepth?: number;
  includeDeleted?: boolean;
}

/**
 * WBS Hierarchy Utilities class
 * Provides methods for working with hierarchical Issue data
 */
export class WBSHierarchyUtils {
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get the next available order index for a parent
   * @param projectId - Project ID
   * @param parentIssueId - Parent issue ID (null for root level)
   * @returns Next available order index
   */
  async getNextOrderIndex(projectId: string, parentIssueId: string | null): Promise<number> {
    const maxOrder = await this.prisma.issue.aggregate({
      where: {
        projectId,
        parentIssueId,
        deletedAt: null,
      },
      _max: {
        orderIndex: true,
      },
    });

    return (maxOrder._max.orderIndex ?? -1) + 1;
  }

  /**
   * Reorder issues within the same parent
   * @param projectId - Project ID
   * @param parentIssueId - Parent issue ID
   * @param issueOrders - Array of {issueId, orderIndex} objects
   */
  async reorderIssues(
    projectId: string, 
    parentIssueId: string | null, 
    issueOrders: { issueId: string; orderIndex: number }[]
  ): Promise<void> {
    // Use transaction to ensure consistency
    await this.prisma.$transaction(async (tx) => {
      for (const { issueId, orderIndex } of issueOrders) {
        await tx.issue.update({
          where: {
            id: issueId,
            projectId,
            parentIssueId,
          },
          data: {
            orderIndex,
          },
        });
      }
    });
  }

  /**
   * Calculate the hierarchy level of an issue
   * @param issueId - Issue ID
   * @param maxDepth - Maximum depth to prevent infinite loops (default: 5)
   * @returns Hierarchy level (0 = root)
   */
  async calculateLevel(issueId: string, maxDepth: number = 5): Promise<number> {
    let level = 0;
    let currentIssueId: string | null = issueId;

    while (currentIssueId && level < maxDepth) {
      const issue: { parentIssueId: string | null } | null = await this.prisma.issue.findUnique({
        where: { id: currentIssueId },
        select: { parentIssueId: true },
      });

      if (!issue?.parentIssueId) {
        break;
      }

      currentIssueId = issue.parentIssueId;
      level++;
    }

    return level;
  }

  /**
   * Validate that moving an issue won't exceed max depth
   * @param issueId - Issue to move
   * @param newParentId - New parent ID
   * @param maxDepth - Maximum allowed depth (default: 5)
   * @returns True if move is valid
   */
  async validateHierarchyDepth(
    issueId: string, 
    newParentId: string | null, 
    maxDepth: number = 5
  ): Promise<boolean> {
    if (!newParentId) {
      return true; // Moving to root is always valid
    }

    // Check if newParentId is a descendant of issueId (would create cycle)
    if (await this.isDescendant(newParentId, issueId)) {
      return false;
    }

    // Calculate new parent depth
    const parentLevel = await this.calculateLevel(newParentId, maxDepth);
    
    // Check if any children would exceed max depth
    const deepestChild = await this.getDeepestChildLevel(issueId);
    const wouldExceedDepth = parentLevel + 1 + deepestChild >= maxDepth;

    return !wouldExceedDepth;
  }

  /**
   * Check if an issue is a descendant of another issue
   * @param possibleDescendantId - ID of possible descendant
   * @param ancestorId - ID of possible ancestor
   * @param maxDepth - Maximum depth to check (default: 5)
   * @returns True if possibleDescendantId is a descendant of ancestorId
   */
  async isDescendant(
    possibleDescendantId: string, 
    ancestorId: string, 
    maxDepth: number = 5
  ): Promise<boolean> {
    let currentId: string | null = possibleDescendantId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const issue: { parentIssueId: string | null } | null = await this.prisma.issue.findUnique({
        where: { id: currentId },
        select: { parentIssueId: true },
      });

      if (!issue?.parentIssueId) {
        break;
      }

      if (issue.parentIssueId === ancestorId) {
        return true;
      }

      currentId = issue.parentIssueId;
      depth++;
    }

    return false;
  }

  /**
   * Get the deepest child level relative to the given issue
   * @param issueId - Root issue ID
   * @param currentDepth - Current recursion depth (internal use)
   * @returns Maximum depth of children
   */
  private async getDeepestChildLevel(issueId: string, currentDepth: number = 0): Promise<number> {
    if (currentDepth >= 5) { // Prevent infinite recursion
      return currentDepth;
    }

    const children = await this.prisma.issue.findMany({
      where: {
        parentIssueId: issueId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (children.length === 0) {
      return 0;
    }

    let maxChildDepth = 0;
    for (const child of children) {
      const childDepth = await this.getDeepestChildLevel(child.id, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return maxChildDepth + 1;
  }

  /**
   * Get issues in hierarchical structure ordered by orderIndex
   * @param projectId - Project ID
   * @param parentIssueId - Parent issue ID (null for root level)
   * @param options - Additional options
   * @returns Array of issues with hierarchical structure
   */
  async getHierarchicalIssues(
    projectId: string, 
    parentIssueId: string | null = null,
    options: HierarchyOptions = {}
  ): Promise<IssueHierarchy[]> {
    const { maxDepth = 5, includeDeleted = false } = options;

    const whereClause: any = {
      projectId,
      parentIssueId,
    };

    if (!includeDeleted) {
      whereClause.deletedAt = null;
    }

    const issues = await this.prisma.issue.findMany({
      where: whereClause,
      orderBy: { orderIndex: 'asc' },
    });

    const result: IssueHierarchy[] = [];
    
    for (const issue of issues) {
      const level = await this.calculateLevel(issue.id, maxDepth);
      const hierarchicalIssue: IssueHierarchy = {
        ...issue,
        level,
        children: [],
      };

      if (level < maxDepth - 1) {
        hierarchicalIssue.children = await this.getHierarchicalIssues(
          projectId, 
          issue.id, 
          options
        );
      }

      result.push(hierarchicalIssue);
    }

    return result;
  }
}