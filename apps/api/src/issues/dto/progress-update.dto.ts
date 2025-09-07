import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, Max, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProgressUpdateDto {
  @ApiProperty({
    description: 'Progress percentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 75
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;

  @ApiPropertyOptional({
    description: 'Optional comment describing the progress change',
    example: 'Completed API implementation phase'
  })
  @IsOptional()
  comment?: string;
}

export class BatchProgressUpdateItemDto {
  @ApiProperty({
    description: 'Issue ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsUUID()
  issueId: string;

  @ApiProperty({
    description: 'Progress percentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 75
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;

  @ApiPropertyOptional({
    description: 'Optional comment for this specific progress update',
    example: 'Completed testing phase'
  })
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    description: 'ETag for optimistic locking',
    example: '"v1-1736187600000"'
  })
  @IsOptional()
  etag?: string;
}

export class BatchProgressUpdateDto {
  @ApiProperty({
    description: 'List of progress updates to apply',
    type: [BatchProgressUpdateItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchProgressUpdateItemDto)
  updates: BatchProgressUpdateItemDto[];

  @ApiPropertyOptional({
    description: 'Global comment for all progress updates in this batch',
    example: 'Weekly progress update'
  })
  @IsOptional()
  globalComment?: string;
}

export class ProgressUpdateResponseDto {
  @ApiProperty({
    description: 'Issue ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  issueId: string;

  @ApiProperty({
    description: 'Previous progress value',
    example: 50
  })
  previousProgress: number;

  @ApiProperty({
    description: 'New progress value',
    example: 75
  })
  newProgress: number;

  @ApiProperty({
    description: 'Computed progress metrics for this issue'
  })
  progressMetrics: {
    isLeafTask: boolean;
    hasChildren: boolean;
    childrenCount: number;
    aggregatedProgress?: number; // Only for parent tasks
    completionEstimate?: string; // ISO date string
  };

  @ApiProperty({
    description: 'Validation results'
  })
  validationResults: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };

  @ApiProperty({
    description: 'New ETag for optimistic locking'
  })
  etag: string;

  @ApiProperty({
    description: 'Updated timestamp'
  })
  updatedAt: string;
}

export class BatchProgressUpdateResponseDto {
  @ApiProperty({
    description: 'Number of successfully updated issues'
  })
  successCount: number;

  @ApiProperty({
    description: 'Number of failed updates'
  })
  errorCount: number;

  @ApiProperty({
    description: 'Individual progress update results',
    type: [ProgressUpdateResponseDto]
  })
  results: ProgressUpdateResponseDto[];

  @ApiProperty({
    description: 'List of errors that occurred during batch update'
  })
  errors: Array<{
    issueId: string;
    error: string;
    code: string;
  }>;

  @ApiProperty({
    description: 'Aggregated progress metrics for affected parent tasks'
  })
  aggregatedMetrics: Array<{
    parentIssueId: string;
    previousAggregatedProgress: number;
    newAggregatedProgress: number;
    affectedChildrenCount: number;
  }>;
}