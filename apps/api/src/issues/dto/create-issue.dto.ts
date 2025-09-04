import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEnum, 
  IsNumber, 
  IsArray, 
  IsOptional, 
  IsUUID, 
  IsDateString,
  Min,
  Max,
  MaxLength
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateIssueDto {
  @ApiProperty({
    description: 'Project ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({
    description: 'Parent Issue ID (for hierarchy)',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsOptional()
  @IsUUID()
  parentIssueId?: string;

  @ApiProperty({
    description: 'Issue title',
    example: 'Implement user authentication',
    maxLength: 256
  })
  @IsString()
  @MaxLength(256)
  title: string;

  @ApiPropertyOptional({
    description: 'Issue description',
    example: 'Add JWT-based authentication system'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Issue status',
    enum: ['todo', 'doing', 'blocked', 'review', 'done'],
    example: 'todo'
  })
  @IsEnum(['todo', 'doing', 'blocked', 'review', 'done'])
  status: string;

  @ApiProperty({
    description: 'Issue type',
    enum: ['feature', 'bug', 'spike', 'chore'],
    example: 'feature'
  })
  @IsEnum(['feature', 'bug', 'spike', 'chore'])
  type: string;

  @ApiProperty({
    description: 'Issue priority (1-10)',
    minimum: 1,
    maximum: 10,
    example: 5
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  priority: number;

  @ApiProperty({
    description: 'Estimate value',
    example: 8,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  estimateValue: number;

  @ApiProperty({
    description: 'Estimate unit',
    enum: ['h', 'd'],
    example: 'h'
  })
  @IsEnum(['h', 'd'])
  estimateUnit: string;

  @ApiPropertyOptional({
    description: 'Assignee ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2025-09-05T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Due date (ISO 8601)',
    example: '2025-09-12T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Progress percentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 0,
    default: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => value ?? 0)
  progress?: number = 0;

  @ApiPropertyOptional({
    description: 'Labels',
    type: [String],
    example: ['frontend', 'authentication']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[] = [];
}