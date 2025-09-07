/**
 * T034 AC1: Integration Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IntegrationsService } from './integrations.service';
import { WebhookEventDto, WebhookSource, WebhookEventType } from './dto/webhook-event.dto';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateWebhookEvent', () => {
    const mockWebhookEvent: WebhookEventDto = {
      source: WebhookSource.GITLAB,
      event_type: WebhookEventType.ISSUE_CREATED,
      timestamp: '2025-01-07T10:30:00Z',
      payload: {
        issue: {
          id: '123',
          title: 'Test Issue',
          description: 'Test Description',
          status: 'open',
          created_at: '2025-01-07T10:30:00Z',
          updated_at: '2025-01-07T10:30:00Z',
        },
      },
    };

    it('should validate webhook event successfully without signature', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.validateWebhookEvent(
        'gitlab',
        'raw payload',
        '',
        mockWebhookEvent,
      );

      expect(result.isValid).toBe(true);
      expect(result.parsedEvent).toBeDefined();
      expect(result.parsedEvent?.source).toBe('gitlab');
    });

    it('should return invalid for missing required fields', async () => {
      const invalidEvent = {
        ...mockWebhookEvent,
        source: undefined as any,
      };

      const result = await service.validateWebhookEvent(
        'gitlab',
        'raw payload',
        '',
        invalidEvent,
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing required event fields');
    });

    it('should validate signature when secret is configured', async () => {
      mockConfigService.get.mockReturnValue('test-secret');

      const result = await service.validateWebhookEvent(
        'gitlab',
        'raw payload',
        'invalid-signature',
        mockWebhookEvent,
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid webhook signature');
    });
  });

  describe('processWebhookEvent', () => {
    it('should handle ping event', async () => {
      const pingEvent = {
        source: 'gitlab' as any,
        event_type: 'ping' as any,
        timestamp: '2025-01-07T10:30:00Z',
        payload: {},
      };

      const result = await service.processWebhookEvent(pingEvent);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Pong!');
      expect(result.eventId).toBeDefined();
    });

    it('should handle issue created event', async () => {
      const issueEvent = {
        source: 'gitlab' as any,
        event_type: 'issue.created' as any,
        timestamp: '2025-01-07T10:30:00Z',
        payload: {
          issue: {
            id: '123',
            title: 'Test Issue',
            description: 'Test Description',
            status: 'open',
            created_at: '2025-01-07T10:30:00Z',
            updated_at: '2025-01-07T10:30:00Z',
          },
        },
      };

      const result = await service.processWebhookEvent(issueEvent);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Issue creation event processed');
      expect(result.eventId).toBeDefined();
    });

    it('should handle missing issue data', async () => {
      const invalidEvent = {
        source: 'gitlab' as any,
        event_type: 'issue.created' as any,
        timestamp: '2025-01-07T10:30:00Z',
        payload: {},
      };

      const result = await service.processWebhookEvent(invalidEvent);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Issue data missing');
    });

    it('should handle unknown event types', async () => {
      const unknownEvent = {
        source: 'gitlab' as any,
        event_type: 'unknown.event' as any,
        timestamp: '2025-01-07T10:30:00Z',
        payload: {},
      };

      const result = await service.processWebhookEvent(unknownEvent);

      expect(result.success).toBe(true);
      expect(result.message).toContain('acknowledged but not processed');
    });
  });
});