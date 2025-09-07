/**
 * T034 AC1: External Integration Service - Webhook Processing
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { 
  WebhookEvent, 
  WebhookValidationResult, 
  WebhookProcessResult 
} from './interfaces/webhook.interface';
import { SignatureValidator } from './utils/signature-validator.util';
import { IssueSyncService } from './services/issue-sync.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private configService: ConfigService,
    private issueSyncService: IssueSyncService,
  ) {}

  /**
   * Validates incoming webhook event
   * @param source - Webhook source (gitlab, github, generic)
   * @param rawPayload - Raw request body for signature validation
   * @param signature - Signature from headers
   * @param eventData - Parsed event data
   * @returns Validation result
   */
  async validateWebhookEvent(
    source: string,
    rawPayload: string | Buffer,
    signature: string,
    eventData: WebhookEventDto,
  ): Promise<WebhookValidationResult> {
    try {
      // Skip signature validation in development mode
      const isDevMode = this.configService.get('NODE_ENV') === 'development';
      if (isDevMode && !signature) {
        this.logger.warn('Skipping webhook signature validation in development mode');
        return {
          isValid: true,
          parsedEvent: this.createWebhookEvent(source, eventData),
        };
      }
      
      // Get webhook secret from configuration
      const secretKey = this.getWebhookSecret(source);
      
      if (!secretKey) {
        this.logger.warn(`No webhook secret configured for source: ${source}`);
        if (isDevMode) {
          // Allow in dev mode without secret
          return {
            isValid: true,
            parsedEvent: this.createWebhookEvent(source, eventData),
          };
        }
        return {
          isValid: false,
          error: 'Webhook secret not configured',
        };
      }

      // Validate signature if provided
      if (signature) {
        const isValidSignature = SignatureValidator.validateSignature(
          source,
          rawPayload,
          signature,
          secretKey,
        );

        if (!isValidSignature) {
          this.logger.warn(`Invalid webhook signature for source: ${source}`);
          return {
            isValid: false,
            error: 'Invalid webhook signature',
          };
        }
      }

      // Basic event data validation
      if (!eventData.source || !eventData.event_type || !eventData.timestamp) {
        return {
          isValid: false,
          error: 'Missing required event fields',
        };
      }

      const webhookEvent: WebhookEvent = {
        source: eventData.source as any,
        event_type: eventData.event_type as any,
        timestamp: eventData.timestamp,
        signature,
        payload: eventData.payload,
      };

      return {
        isValid: true,
        parsedEvent: webhookEvent,
      };
    } catch (error) {
      this.logger.error('Webhook validation error:', error);
      return {
        isValid: false,
        error: 'Webhook validation failed',
      };
    }
  }

  /**
   * Processes validated webhook event
   * @param event - Validated webhook event
   * @returns Processing result
   */
  async processWebhookEvent(event: WebhookEvent): Promise<WebhookProcessResult> {
    const eventId = this.generateEventId();
    const processedAt = new Date().toISOString();

    try {
      this.logger.log(`Processing webhook event: ${event.event_type} from ${event.source}`);

      // Handle different event types
      switch (event.event_type) {
        case 'ping':
          return this.handlePingEvent(event, eventId, processedAt);
        
        case 'issue.created':
          return this.handleIssueCreatedEvent(event, eventId, processedAt);
        
        case 'issue.updated':
          return this.handleIssueUpdatedEvent(event, eventId, processedAt);
        
        case 'issue.closed':
          return this.handleIssueClosedEvent(event, eventId, processedAt);
        
        default:
          this.logger.warn(`Unhandled event type: ${event.event_type}`);
          return {
            success: true,
            message: `Event type ${event.event_type} acknowledged but not processed`,
            processedAt,
            eventId,
          };
      }
    } catch (error) {
      this.logger.error('Webhook processing error:', error);
      return {
        success: false,
        message: 'Webhook processing failed',
        processedAt,
        eventId,
      };
    }
  }

  /**
   * Handles ping events for webhook verification
   */
  private async handlePingEvent(
    event: WebhookEvent,
    eventId: string,
    processedAt: string,
  ): Promise<WebhookProcessResult> {
    this.logger.log(`Ping event received from ${event.source}`);
    
    return {
      success: true,
      message: 'Pong! Webhook endpoint is active',
      processedAt,
      eventId,
    };
  }

  /**
   * Handles issue creation events
   */
  private async handleIssueCreatedEvent(
    event: WebhookEvent,
    eventId: string,
    processedAt: string,
  ): Promise<WebhookProcessResult> {
    const issue = event.payload.issue;
    
    if (!issue) {
      return {
        success: false,
        message: 'Issue data missing in event payload',
        processedAt,
        eventId,
      };
    }

    this.logger.log(`Issue created: ${issue.title} (${issue.id}) from ${event.source}`);
    
    // Issue synchronization with internal system
    const syncResult = await this.issueSyncService.syncCreatedIssue(event);
    
    if (!syncResult.success) {
      this.logger.warn(`Issue sync failed: ${syncResult.message}`);
    }
    
    return {
      success: true,
      message: `Issue creation event processed: ${issue.title}${syncResult.success ? ' and synced' : ' but sync failed'}`,
      processedAt,
      eventId,
    };
  }

  /**
   * Handles issue update events
   */
  private async handleIssueUpdatedEvent(
    event: WebhookEvent,
    eventId: string,
    processedAt: string,
  ): Promise<WebhookProcessResult> {
    const issue = event.payload.issue;
    
    if (!issue) {
      return {
        success: false,
        message: 'Issue data missing in event payload',
        processedAt,
        eventId,
      };
    }

    this.logger.log(`Issue updated: ${issue.title} (${issue.id}) from ${event.source}`);
    
    // Issue synchronization with internal system
    const syncResult = await this.issueSyncService.syncUpdatedIssue(event);
    
    if (!syncResult.success) {
      this.logger.warn(`Issue update sync failed: ${syncResult.message}`);
    }
    
    return {
      success: true,
      message: `Issue update event processed: ${issue.title}${syncResult.success ? ' and synced' : ' but sync failed'}`,
      processedAt,
      eventId,
    };
  }

  /**
   * Handles issue closure events
   */
  private async handleIssueClosedEvent(
    event: WebhookEvent,
    eventId: string,
    processedAt: string,
  ): Promise<WebhookProcessResult> {
    const issue = event.payload.issue;
    
    if (!issue) {
      return {
        success: false,
        message: 'Issue data missing in event payload',
        processedAt,
        eventId,
      };
    }

    this.logger.log(`Issue closed: ${issue.title} (${issue.id}) from ${event.source}`);
    
    // Issue synchronization with internal system
    const syncResult = await this.issueSyncService.syncClosedIssue(event);
    
    if (!syncResult.success) {
      this.logger.warn(`Issue closure sync failed: ${syncResult.message}`);
    }
    
    return {
      success: true,
      message: `Issue closure event processed: ${issue.title}${syncResult.success ? ' and synced' : ' but sync failed'}`,
      processedAt,
      eventId,
    };
  }

  /**
   * Gets webhook secret from configuration
   */
  private getWebhookSecret(source: string): string | undefined {
    const configKey = `WEBHOOK_SECRET_${source.toUpperCase()}`;
    return this.configService.get<string>(configKey);
  }

  /**
   * Creates a WebhookEvent from source and event data
   */
  private createWebhookEvent(source: string, eventData: WebhookEventDto): WebhookEvent {
    return {
      source: source as any,
      event_type: eventData.event_type,
      timestamp: eventData.timestamp,
      payload: eventData.payload,
    };
  }

  /**
   * Generates unique event ID for tracking
   */
  private generateEventId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `evt_${timestamp}_${random}`;
  }
}