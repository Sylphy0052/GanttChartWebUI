/**
 * T034 AC1: Webhook Response DTOs for External Integration
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Webhook event processed successfully' })
  message: string;

  @ApiProperty({ example: '2025-01-07T10:30:00Z' })
  processedAt: string;

  @ApiPropertyOptional({ example: 'evt_123456789' })
  eventId?: string;
}

export class WebhookErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Invalid webhook signature' })
  message: string;

  @ApiProperty({ example: '2025-01-07T10:30:00Z' })
  processedAt: string;

  @ApiPropertyOptional({ example: 'INVALID_SIGNATURE' })
  errorCode?: string;

  @ApiPropertyOptional({ example: 'The provided signature does not match the expected value' })
  details?: string;
}