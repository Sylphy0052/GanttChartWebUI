import { ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEnum, 
  IsNumber, 
  IsOptional, 
  IsUUID,
  IsDateString,
  Min,
  Max
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryIssueDto {
  @ApiPropertyOptional({
    description: 'Project ID filter',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Assignee ID filter',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Status filter',
    enum: ['todo', 'doing', 'blocked', 'review', 'done']
  })
  @IsOptional()
  @IsEnum(['todo', 'doing', 'blocked', 'review', 'done'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Type filter',
    enum: ['feature', 'bug', 'spike', 'chore']
  })
  @IsOptional()
  @IsEnum(['feature', 'bug', 'spike', 'chore'])
  type?: string;

  @ApiPropertyOptional({
    description: 'Label filter',
    example: 'frontend'
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Minimum priority',
    minimum: 1,
    maximum: 10,
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  priorityMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum priority',
    minimum: 1,
    maximum: 10,
    example: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  priorityMax?: number;

  @ApiPropertyOptional({
    description: 'Start date filter (from)',
    example: '2025-09-01T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Due date filter (to)',
    example: '2025-09-30T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @ApiPropertyOptional({
    description: 'Search query (title/description)',
    example: 'authentication'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Include deleted issues',
    example: false,
    default: false
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Page size',
    minimum: 1,
    maximum: 200,
    example: 50,
    default: 50
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Cursor for pagination',
    example: 'eyJpZCI6IjAxMjM0NTY3LTg5YWItY2RlZi0wMTIzLTQ1Njc4OWFiY2RlZiJ9'
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc'
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'],
    example: 'updatedAt',
    default: 'updatedAt'
  })
  @IsOptional()
  @IsEnum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'])
  sortBy?: string = 'updatedAt';
}