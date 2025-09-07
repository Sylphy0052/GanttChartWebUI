/**
 * T034 AC1: External Integration Controller - Webhook Endpoints
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
  Param,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { IntegrationsService } from './integrations.service';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { WebhookResponseDto, WebhookErrorResponseDto } from './dto/webhook-response.dto';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(private readonly integrationsService: IntegrationsService) {}

  @Public()
  @Post('webhook/:type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive webhook events from external systems',
    description: 'Endpoint for receiving webhook events from GitLab, GitHub, or other external systems',
  })
  @ApiParam({
    name: 'type',
    description: 'Webhook source type',
    enum: ['gitlab', 'github', 'generic'],
    example: 'gitlab',
  })
  @ApiHeader({
    name: 'X-Gitlab-Token',
    description: 'GitLab webhook secret token',
    required: false,
  })
  @ApiHeader({
    name: 'X-Hub-Signature-256',
    description: 'GitHub webhook signature',
    required: false,
  })
  @ApiHeader({
    name: 'X-GitHub-Event',
    description: 'GitHub event type',
    required: false,
  })
  @ApiHeader({
    name: 'X-Gitlab-Event',
    description: 'GitLab event type',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook data',
    type: WebhookErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid webhook signature',
    type: WebhookErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: WebhookErrorResponseDto,
  })
  async receiveWebhook(
    @Param('type') type: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<WebhookResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Receiving webhook: ${type} from ${req.ip}`);

      // Get signature from headers based on source type
      const signature = this.extractSignature(type, headers);
      
      // Get raw body for signature validation
      const rawBody = (req as any).rawBody || JSON.stringify(body);
      
      // Parse and validate webhook event
      const eventData = await this.parseWebhookEvent(type, body, headers);
      
      // Validate the webhook event
      const validationResult = await this.integrationsService.validateWebhookEvent(
        type,
        rawBody,
        signature,
        eventData,
      );

      if (!validationResult.isValid) {
        const errorResponse: WebhookErrorResponseDto = {
          success: false,
          message: validationResult.error || 'Webhook validation failed',
          processedAt: new Date().toISOString(),
          errorCode: 'VALIDATION_FAILED',
          details: validationResult.error,
        };

        throw new HttpException(errorResponse, HttpStatus.BAD_REQUEST);
      }

      // Process the validated webhook event
      const processResult = await this.integrationsService.processWebhookEvent(
        validationResult.parsedEvent!,
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`Webhook processed in ${processingTime}ms: ${processResult.eventId}`);

      if (!processResult.success) {
        const errorResponse: WebhookErrorResponseDto = {
          success: false,
          message: processResult.message,
          processedAt: processResult.processedAt,
          errorCode: 'PROCESSING_FAILED',
        };

        throw new HttpException(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: processResult.success,
        message: processResult.message,
        processedAt: processResult.processedAt,
        eventId: processResult.eventId,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Webhook processing failed in ${processingTime}ms:`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      const errorResponse: WebhookErrorResponseDto = {
        success: false,
        message: 'Internal server error',
        processedAt: new Date().toISOString(),
        errorCode: 'INTERNAL_ERROR',
        details: error.message,
      };

      throw new HttpException(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @Post('webhook/:type/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test webhook endpoint connectivity',
    description: 'Simple endpoint to test webhook connectivity and configuration',
  })
  @ApiParam({
    name: 'type',
    description: 'Webhook source type',
    enum: ['gitlab', 'github', 'generic'],
  })
  @ApiResponse({
    status: 200,
    description: 'Test successful',
    type: WebhookResponseDto,
  })
  async testWebhook(@Param('type') type: string): Promise<WebhookResponseDto> {
    this.logger.log(`Webhook test endpoint called for: ${type}`);
    
    return {
      success: true,
      message: `Webhook endpoint for ${type} is active and ready to receive events`,
      processedAt: new Date().toISOString(),
      eventId: `test_${Date.now()}`,
    };
  }

  /**
   * Extracts signature from headers based on webhook source
   */
  private extractSignature(type: string, headers: Record<string, string>): string {
    switch (type.toLowerCase()) {
      case 'gitlab':
        return headers['x-gitlab-token'] || headers['X-Gitlab-Token'] || '';
      case 'github':
        return headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'] || '';
      default:
        return headers['x-webhook-signature'] || headers['X-Webhook-Signature'] || '';
    }
  }

  /**
   * Parses webhook event from raw data
   */
  private async parseWebhookEvent(
    type: string,
    body: any,
    headers: Record<string, string>,
  ): Promise<WebhookEventDto> {
    try {
      // Determine event type from headers
      let eventType = 'ping';
      
      if (type === 'gitlab') {
        const gitlabEvent = headers['x-gitlab-event'] || headers['X-Gitlab-Event'] || '';
        eventType = this.mapGitLabEvent(gitlabEvent);
      } else if (type === 'github') {
        const githubEvent = headers['x-github-event'] || headers['X-GitHub-Event'] || '';
        eventType = this.mapGitHubEvent(githubEvent);
      }

      // Create standardized webhook event
      const webhookEvent: WebhookEventDto = {
        source: type as any,
        event_type: eventType as any,
        timestamp: new Date().toISOString(),
        payload: {
          issue: body.object_attributes || body.issue,
          user: body.user,
          repository: body.project || body.repository,
        },
      };

      return webhookEvent;
    } catch (error) {
      this.logger.error('Failed to parse webhook event:', error);
      throw new HttpException('Invalid webhook payload', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Maps GitLab event types to standardized event types
   */
  private mapGitLabEvent(gitlabEvent: string): string {
    switch (gitlabEvent) {
      case 'Issue Hook':
        return 'issue.created'; // Will be refined based on action
      case 'issues':
        return 'issue.updated';
      default:
        return 'ping';
    }
  }

  /**
   * Maps GitHub event types to standardized event types
   */
  private mapGitHubEvent(githubEvent: string): string {
    switch (githubEvent) {
      case 'issues':
        return 'issue.created'; // Will be refined based on action
      case 'ping':
        return 'ping';
      default:
        return 'ping';
    }
  }
}