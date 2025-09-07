/**
 * T034 AC1: Webhook Event DTOs for External Integration
 */

import { IsString, IsEnum, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WebhookSource {
  GITLAB = 'gitlab',
  GITHUB = 'github',
  GENERIC = 'generic',
}

export enum WebhookEventType {
  ISSUE_CREATED = 'issue.created',
  ISSUE_UPDATED = 'issue.updated',
  ISSUE_CLOSED = 'issue.closed',
  PING = 'ping',
}

export class WebhookIssueDto {
  @ApiProperty({ example: '123' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'Fix login bug' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'User cannot login with valid credentials' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'open' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiPropertyOptional({ example: ['bug', 'high-priority'] })
  @IsOptional()
  labels?: string[];

  @ApiProperty({ example: '2025-01-07T10:00:00Z' })
  @IsString()
  created_at: string;

  @ApiProperty({ example: '2025-01-07T11:00:00Z' })
  @IsString()
  updated_at: string;
}

export class WebhookUserDto {
  @ApiProperty({ example: '456' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsString()
  email: string;
}

export class WebhookRepositoryDto {
  @ApiProperty({ example: '789' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'my-project' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://gitlab.com/org/my-project' })
  @IsString()
  url: string;
}

export class WebhookPayloadDto {
  @ApiPropertyOptional({ type: WebhookIssueDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookIssueDto)
  issue?: WebhookIssueDto;

  @ApiPropertyOptional({ type: WebhookUserDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookUserDto)
  user?: WebhookUserDto;

  @ApiPropertyOptional({ type: WebhookRepositoryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookRepositoryDto)
  repository?: WebhookRepositoryDto;
}

export class WebhookEventDto {
  @ApiProperty({ enum: WebhookSource, example: WebhookSource.GITLAB })
  @IsEnum(WebhookSource)
  source: WebhookSource;

  @ApiProperty({ enum: WebhookEventType, example: WebhookEventType.ISSUE_CREATED })
  @IsEnum(WebhookEventType)
  event_type: WebhookEventType;

  @ApiProperty({ example: '2025-01-07T10:30:00Z' })
  @IsString()
  timestamp: string;

  @ApiPropertyOptional({ example: 'sha256=abc123...' })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiProperty({ type: WebhookPayloadDto })
  @ValidateNested()
  @Type(() => WebhookPayloadDto)
  @IsObject()
  payload: WebhookPayloadDto;
}