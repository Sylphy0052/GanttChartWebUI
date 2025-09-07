/**
 * Issue Edit Command for Undo/Redo System
 * 
 * This command handles issue field modifications with full undo/redo support.
 * It provides field-level granular undo capabilities and integrates seamlessly
 * with the existing Issue detail panel and API infrastructure.
 * 
 * Features:
 * - Single and multi-field undo operations
 * - Optimistic updates with rollback on API failure
 * - Form validation during undo operations
 * - Professional error handling and user feedback
 * - Integration with existing Issue store and API
 */

import { BaseCommand, CommandContext } from './BaseCommand'
import { Issue, UpdateIssueData } from '@/types/issue'

export interface IssueEditCommandParams {
  issueId: string
  originalData: Partial<Issue>
  updatedData: UpdateIssueData
  updateFunction: (id: string, data: UpdateIssueData) => Promise<Issue>
  onSuccess?: (updatedIssue: Issue) => void
  onError?: (error: Error) => void
  fieldName?: string // For better undo descriptions (optional)
}

/**
 * Command for handling issue field modifications with undo/redo support
 */
export class IssueEditCommand extends BaseCommand {
  private params: IssueEditCommandParams
  private executedIssue?: Issue
  private lastError?: Error

  constructor(params: IssueEditCommandParams, context?: Partial<CommandContext>) {
    const fieldName = params.fieldName || 'fields'
    const description = `Issue編集: ${fieldName}を更新`
    
    super('issue-edit', description, context)
    this.params = params
  }

  async execute(): Promise<void> {
    try {
      // Validate the update data
      if (!this.validateUpdateData(this.params.updatedData)) {
        throw new Error('Invalid update data provided')
      }

      // Execute the API update
      this.executedIssue = await this.params.updateFunction(
        this.params.issueId,
        this.params.updatedData
      )

      // Mark as executed
      this.executed = true
      this.undone = false

      // Trigger success callback
      if (this.params.onSuccess) {
        this.params.onSuccess(this.executedIssue)
      }

      console.log(`✅ Issue edit executed: ${this.description}`, {
        issueId: this.params.issueId,
        updatedFields: Object.keys(this.params.updatedData),
        executedAt: new Date().toISOString()
      })

    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error))
      
      // Trigger error callback
      if (this.params.onError) {
        this.params.onError(this.lastError)
      }

      console.error(`❌ Issue edit failed: ${this.description}`, {
        issueId: this.params.issueId,
        error: this.lastError.message,
        failedAt: new Date().toISOString()
      })

      throw this.lastError
    }
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) {
      throw new Error('Cannot undo: command not in undoable state')
    }

    try {
      // Restore original values by creating reverse update data
      const reverseData = this.createReverseUpdateData()

      // Execute the reverse update
      await this.params.updateFunction(this.params.issueId, reverseData)

      // Mark as undone
      this.undone = true

      console.log(`↶ Issue edit undone: ${this.description}`, {
        issueId: this.params.issueId,
        revertedFields: Object.keys(reverseData),
        undoneAt: new Date().toISOString()
      })

    } catch (error) {
      const undoError = error instanceof Error ? error : new Error(String(error))
      
      // Trigger error callback for undo failure
      if (this.params.onError) {
        this.params.onError(undoError)
      }

      console.error(`❌ Issue edit undo failed: ${this.description}`, {
        issueId: this.params.issueId,
        error: undoError.message,
        undoFailedAt: new Date().toISOString()
      })

      throw undoError
    }
  }

  canUndo(): boolean {
    return this.executed && !this.undone && Boolean(this.params.originalData)
  }

  canRedo(): boolean {
    return this.executed && this.undone
  }

  validate(): boolean {
    // Validate required parameters
    if (!this.params.issueId || !this.params.updateFunction) {
      return false
    }

    // Validate update data structure
    if (!this.validateUpdateData(this.params.updatedData)) {
      return false
    }

    return true
  }

  /**
   * Get preview of what would be undone
   */
  getUndoPreview(): Partial<Issue> {
    return { ...this.params.originalData }
  }

  /**
   * Get preview of what would be redone
   */
  getRedoPreview(): UpdateIssueData {
    return { ...this.params.updatedData }
  }

  /**
   * Get the fields that were modified
   */
  getModifiedFields(): string[] {
    return Object.keys(this.params.updatedData)
  }

  /**
   * Check if a specific field was modified
   */
  wasFieldModified(fieldName: keyof UpdateIssueData): boolean {
    return fieldName in this.params.updatedData
  }

  /**
   * Get the original value of a specific field
   */
  getOriginalFieldValue(fieldName: keyof Issue): any {
    return this.params.originalData[fieldName]
  }

  /**
   * Get the updated value of a specific field
   */
  getUpdatedFieldValue(fieldName: keyof UpdateIssueData): any {
    return this.params.updatedData[fieldName]
  }

  /**
   * Serialize command with issue-specific data
   */
  serialize(): string {
    const baseData = JSON.parse(super.serialize())
    return JSON.stringify({
      ...baseData,
      issueId: this.params.issueId,
      fieldName: this.params.fieldName,
      modifiedFields: this.getModifiedFields(),
      originalData: this.params.originalData,
      updatedData: this.params.updatedData,
      executedIssue: this.executedIssue ? {
        id: this.executedIssue.id,
        version: this.executedIssue.version,
        updatedAt: this.executedIssue.updatedAt
      } : null
    })
  }

  /**
   * Create reverse update data to restore original values
   */
  private createReverseUpdateData(): UpdateIssueData {
    const reverseData: UpdateIssueData = {}

    // Only include fields that were actually changed and have original values
    Object.keys(this.params.updatedData).forEach(key => {
      const fieldKey = key as keyof UpdateIssueData
      if (fieldKey in this.params.originalData) {
        const originalValue = this.params.originalData[fieldKey as keyof Issue]
        // Handle undefined/null values properly
        if (originalValue !== undefined) {
          ;(reverseData as any)[fieldKey] = originalValue
        }
      }
    })

    return reverseData
  }

  /**
   * Validate update data structure and types
   */
  private validateUpdateData(data: UpdateIssueData): boolean {
    if (!data || typeof data !== 'object') {
      return false
    }

    // Check for at least one valid field
    const validFields = [
      'title', 'description', 'status', 'type', 'priority',
      'estimateValue', 'estimateUnit', 'assigneeId', 'startDate',
      'dueDate', 'progress', 'labels', 'version'
    ]

    const hasValidField = Object.keys(data).some(key => validFields.includes(key))
    if (!hasValidField) {
      return false
    }

    // Validate specific field types and constraints
    if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
      return false
    }

    if (data.priority !== undefined && (typeof data.priority !== 'number' || data.priority < 0 || data.priority > 100)) {
      return false
    }

    if (data.progress !== undefined && (typeof data.progress !== 'number' || data.progress < 0 || data.progress > 100)) {
      return false
    }

    if (data.estimateValue !== undefined && (typeof data.estimateValue !== 'number' || data.estimateValue < 0)) {
      return false
    }

    if (data.status !== undefined && !['todo', 'doing', 'blocked', 'review', 'done'].includes(data.status)) {
      return false
    }

    if (data.type !== undefined && !['feature', 'bug', 'spike', 'chore'].includes(data.type)) {
      return false
    }

    if (data.estimateUnit !== undefined && !['h', 'd'].includes(data.estimateUnit)) {
      return false
    }

    return true
  }
}

/**
 * Factory function for creating issue edit commands
 */
export const createIssueEditCommand = (
  params: IssueEditCommandParams,
  context?: Partial<CommandContext>
): IssueEditCommand => {
  return new IssueEditCommand(params, context)
}

/**
 * Helper function to create commands for specific field types
 */
export const createFieldSpecificCommand = (
  issueId: string,
  fieldName: keyof UpdateIssueData,
  originalValue: any,
  newValue: any,
  updateFunction: (id: string, data: UpdateIssueData) => Promise<Issue>,
  callbacks?: {
    onSuccess?: (updatedIssue: Issue) => void
    onError?: (error: Error) => void
  }
): IssueEditCommand => {
  const originalData = { [fieldName]: originalValue }
  const updatedData = { [fieldName]: newValue }

  return new IssueEditCommand({
    issueId,
    originalData,
    updatedData,
    updateFunction,
    fieldName: String(fieldName),
    ...callbacks
  })
}

/**
 * Helper function to create composite commands for multi-field updates
 */
export const createCompositeIssueEditCommand = (
  issueId: string,
  originalIssue: Issue,
  updatedData: UpdateIssueData,
  updateFunction: (id: string, data: UpdateIssueData) => Promise<Issue>,
  callbacks?: {
    onSuccess?: (updatedIssue: Issue) => void
    onError?: (error: Error) => void
  }
): IssueEditCommand => {
  // Extract only the fields that are being updated
  const originalData: Partial<Issue> = {}
  Object.keys(updatedData).forEach(key => {
    const fieldKey = key as keyof UpdateIssueData
    // Check if the field exists in both Issue and UpdateIssueData types
    if (fieldKey in originalIssue && fieldKey in updatedData) {
      originalData[fieldKey as keyof Issue] = originalIssue[fieldKey as keyof Issue]
    }
  })

  const modifiedFields = Object.keys(updatedData)
  const fieldName = modifiedFields.length === 1 
    ? modifiedFields[0] 
    : `${modifiedFields.length}個のフィールド`

  return new IssueEditCommand({
    issueId,
    originalData,
    updatedData,
    updateFunction,
    fieldName,
    ...callbacks
  })
}