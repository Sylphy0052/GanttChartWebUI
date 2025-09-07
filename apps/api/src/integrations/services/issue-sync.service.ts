import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IssuesService } from '../../issues/issues.service';
import { ProjectsService } from '../../projects/projects.service';
import { WebhookEvent } from '../interfaces/webhook.interface';
import { 
  SyncResult, 
  SyncConfiguration, 
  IssueStatus,
  ExternalIssueData,
  InternalIssueData 
} from '../interfaces/issue-sync.interface';
import { CreateIssueDto } from '../../issues/dto/create-issue.dto';
import { UpdateIssueDto } from '../../issues/dto/update-issue.dto';

@Injectable()
export class IssueSyncService {
  private readonly logger = new Logger(IssueSyncService.name);
  private syncConfig: SyncConfiguration;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly issuesService: IssuesService,
    private readonly projectsService: ProjectsService,
  ) {
    this.initializeSyncConfig();
  }

  private initializeSyncConfig(): void {
    this.syncConfig = {
      projectMapping: this.configService.get('WEBHOOK_PROJECT_MAPPING', {
        'gantt-chart-web-ui': this.configService.get('DEFAULT_PROJECT_ID', 'default-project-id'),
      }),
      statusMapping: {
        'open': 'todo',
        'opened': 'todo',
        'in-progress': 'in_progress',
        'in_progress': 'in_progress',
        'closed': 'done',
        'done': 'done',
        'resolved': 'done',
        'completed': 'done',
        'cancelled': 'done',
        'canceled': 'done',
      },
      defaultOptions: {
        fallbackUserId: this.configService.get('FALLBACK_USER_ID', 'system-user'),
        defaultStatus: 'todo' as IssueStatus,
        enableAutoUserCreation: this.configService.get('ENABLE_AUTO_USER_CREATION', false),
      },
    };
    
    this.logger.log('Issue sync configuration initialized');
    this.logger.debug(`Project mappings: ${JSON.stringify(this.syncConfig.projectMapping)}`);
    this.logger.debug(`Fallback user ID: ${this.syncConfig.defaultOptions.fallbackUserId}`);
  }

  async syncCreatedIssue(webhookEvent: WebhookEvent): Promise<SyncResult> {
    try {
      this.logger.log(`Syncing created issue from ${webhookEvent.source}`);
      
      const externalIssue = this.extractExternalIssueData(webhookEvent);
      if (!externalIssue) {
        return this.createErrorResult(externalIssue?.id || 'unknown', 'Failed to extract issue data from webhook');
      }

      const internalIssueData = await this.transformToInternalFormat(externalIssue, webhookEvent);
      if (!internalIssueData) {
        return this.createErrorResult(externalIssue.id, 'Failed to transform issue data to internal format');
      }

      const projectId = await this.resolveProjectForWebhook(webhookEvent);
      if (!projectId) {
        return this.createErrorResult(externalIssue.id, 'Failed to resolve project for webhook');
      }

      const createDto: CreateIssueDto = {
        projectId,
        title: internalIssueData.title,
        description: internalIssueData.description,
        status: internalIssueData.status,
        type: internalIssueData.type,
        priority: internalIssueData.priority,
        estimateValue: internalIssueData.estimateValue,
        estimateUnit: internalIssueData.estimateUnit,
        assigneeId: internalIssueData.assigneeId,
        labels: internalIssueData.labels,
      };

      const createdIssue = await this.issuesService.create(
        projectId,
        createDto,
        this.syncConfig.defaultOptions.fallbackUserId
      );

      this.logger.log(`Successfully synced issue: ${createdIssue.id} from external ID: ${externalIssue.id}`);
      
      return {
        success: true,
        message: `Issue created successfully: ${createdIssue.title}`,
        issueId: createdIssue.id,
        externalIssueId: externalIssue.id,
      };
    } catch (error) {
      this.logger.error(`Failed to sync created issue: ${error.message}`, error.stack);
      return this.createErrorResult(
        webhookEvent.payload.issue?.id || 'unknown',
        `Sync failed: ${error.message}`
      );
    }
  }

  async syncUpdatedIssue(webhookEvent: WebhookEvent): Promise<SyncResult> {
    try {
      this.logger.log(`Syncing updated issue from ${webhookEvent.source}`);
      
      const externalIssue = this.extractExternalIssueData(webhookEvent);
      if (!externalIssue) {
        return this.createErrorResult(externalIssue?.id || 'unknown', 'Failed to extract issue data from webhook');
      }

      // For now, we'll log the update but not implement full update sync
      // This is a placeholder for Phase 2 implementation
      this.logger.log(`Issue update detected: ${externalIssue.title} (${externalIssue.id})`);
      
      return {
        success: true,
        message: `Issue update processed: ${externalIssue.title}`,
        externalIssueId: externalIssue.id,
      };
    } catch (error) {
      this.logger.error(`Failed to sync updated issue: ${error.message}`, error.stack);
      return this.createErrorResult(
        webhookEvent.payload.issue?.id || 'unknown',
        `Update sync failed: ${error.message}`
      );
    }
  }

  async syncClosedIssue(webhookEvent: WebhookEvent): Promise<SyncResult> {
    try {
      this.logger.log(`Syncing closed issue from ${webhookEvent.source}`);
      
      const externalIssue = this.extractExternalIssueData(webhookEvent);
      if (!externalIssue) {
        return this.createErrorResult(externalIssue?.id || 'unknown', 'Failed to extract issue data from webhook');
      }

      // For now, we'll log the closure but not implement full close sync
      // This is a placeholder for Phase 2 implementation  
      this.logger.log(`Issue closure detected: ${externalIssue.title} (${externalIssue.id})`);
      
      return {
        success: true,
        message: `Issue closure processed: ${externalIssue.title}`,
        externalIssueId: externalIssue.id,
      };
    } catch (error) {
      this.logger.error(`Failed to sync closed issue: ${error.message}`, error.stack);
      return this.createErrorResult(
        webhookEvent.payload.issue?.id || 'unknown',
        `Close sync failed: ${error.message}`
      );
    }
  }

  private extractExternalIssueData(webhookEvent: WebhookEvent): ExternalIssueData | null {
    const issue = webhookEvent.payload.issue;
    if (!issue) {
      return null;
    }

    return {
      id: issue.id.toString(),
      title: issue.title,
      description: issue.description || '',
      status: issue.status,
      assignee: issue.assignee,
      labels: issue.labels,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    };
  }

  private async transformToInternalFormat(
    externalIssue: ExternalIssueData,
    webhookEvent: WebhookEvent
  ): Promise<InternalIssueData | null> {
    try {
      const assigneeId = await this.mapExternalUserToInternal(externalIssue.assignee);
      const status = this.mapExternalStatusToInternal(externalIssue.status);
      const type = this.inferIssueType(externalIssue.labels);

      return {
        title: externalIssue.title,
        description: externalIssue.description,
        status,
        assigneeId,
        labels: externalIssue.labels,
        type,
        priority: 5, // Default priority
        estimateValue: 1, // Default estimate
        estimateUnit: 'h' as const,
      };
    } catch (error) {
      this.logger.error(`Failed to transform external issue data: ${error.message}`);
      return null;
    }
  }

  async mapExternalUserToInternal(email?: string): Promise<string | undefined> {
    if (!email) {
      return this.syncConfig.defaultOptions.fallbackUserId;
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (user) {
        return user.id;
      }

      this.logger.warn(`User not found for email: ${email}, using fallback user`);
      return this.syncConfig.defaultOptions.fallbackUserId;
    } catch (error) {
      this.logger.error(`Failed to lookup user by email ${email}: ${error.message}`);
      return this.syncConfig.defaultOptions.fallbackUserId;
    }
  }

  mapExternalStatusToInternal(externalStatus: string): IssueStatus {
    const mappedStatus = this.syncConfig.statusMapping[externalStatus.toLowerCase()];
    if (mappedStatus) {
      return mappedStatus;
    }

    this.logger.warn(`Unknown external status: ${externalStatus}, using default: ${this.syncConfig.defaultOptions.defaultStatus}`);
    return this.syncConfig.defaultOptions.defaultStatus;
  }

  async resolveProjectForWebhook(webhookEvent: WebhookEvent): Promise<string | null> {
    try {
      const repositoryName = webhookEvent.payload.repository?.name;
      if (!repositoryName) {
        this.logger.warn('Repository name not found in webhook payload');
        return null;
      }

      const projectId = this.syncConfig.projectMapping[repositoryName];
      if (projectId) {
        // Verify project exists
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true },
        });

        if (project) {
          return projectId;
        } else {
          this.logger.warn(`Mapped project ID ${projectId} not found in database`);
        }
      }

      // Fallback to default project if configured
      const defaultProjectId = this.configService.get('DEFAULT_PROJECT_ID');
      if (defaultProjectId) {
        this.logger.log(`Using default project ID: ${defaultProjectId}`);
        return defaultProjectId;
      }

      this.logger.error(`No project mapping found for repository: ${repositoryName}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to resolve project for webhook: ${error.message}`);
      return null;
    }
  }

  private inferIssueType(labels?: string[]): 'feature' | 'bug' | 'task' {
    if (!labels || labels.length === 0) {
      return 'task'; // Default type
    }

    const labelStr = labels.join(' ').toLowerCase();
    
    if (labelStr.includes('bug') || labelStr.includes('fix')) {
      return 'bug';
    }
    
    if (labelStr.includes('feature') || labelStr.includes('enhancement')) {
      return 'feature';
    }

    return 'task';
  }

  private createErrorResult(externalIssueId: string, message: string, additionalErrors?: string[]): SyncResult {
    const errors = [message];
    if (additionalErrors && additionalErrors.length > 0) {
      errors.push(...additionalErrors);
    }
    
    return {
      success: false,
      message,
      externalIssueId,
      errors,
    };
  }

  private async validateSyncPrerequisites(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if fallback user exists
      const fallbackUserId = this.syncConfig.defaultOptions.fallbackUserId;
      if (fallbackUserId && fallbackUserId !== 'system-user') {
        const fallbackUser = await this.prisma.user.findUnique({
          where: { id: fallbackUserId },
          select: { id: true },
        });

        if (!fallbackUser) {
          errors.push(`Fallback user not found: ${fallbackUserId}`);
        }
      }

      // Check if default project exists if configured
      const defaultProjectId = this.configService.get('DEFAULT_PROJECT_ID');
      if (defaultProjectId && defaultProjectId !== 'default-project-id') {
        const defaultProject = await this.prisma.project.findUnique({
          where: { id: defaultProjectId },
          select: { id: true },
        });

        if (!defaultProject) {
          errors.push(`Default project not found: ${defaultProjectId}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return {
        isValid: false,
        errors,
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    try {
      const validation = await this.validateSyncPrerequisites();
      
      if (!validation.isValid) {
        this.logger.warn(`Issue sync health check failed: ${validation.errors.join(', ')}`);
      }

      return {
        healthy: validation.isValid,
        issues: validation.errors,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        healthy: false,
        issues: [`Health check error: ${error.message}`],
      };
    }
  }
}