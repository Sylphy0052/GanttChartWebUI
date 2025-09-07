import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min, Max, IsArray, ValidateNested } from 'class-validator';
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

  @ApiProperty({ 
    description: 'Additional hours spent since last update', 
    minimum: 0, 
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  spentHours?: number;

  @ApiProperty({ 
    description: 'Progress update notes', 
    required: false 
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProgressResponseDto {
  @ApiProperty({ description: 'Issue ID' })
  id: string;

  @ApiProperty({ description: 'Previous progress percentage' })
  previousProgress: number;

  @ApiProperty({ description: 'New progress percentage' })
  newProgress: number;

  @ApiProperty({ description: 'Whether status changed due to progress update' })
  statusChanged: boolean;

  @ApiProperty({ description: 'New status (if changed)' })
  newStatus: string;

  @ApiProperty({ description: 'Total spent hours' })
  spentTotal: number;

  @ApiProperty({ description: 'Update timestamp' })
  updatedAt: string;
}

export class BulkProgressUpdateItemDto {
  @ApiProperty({ description: 'Issue ID' })
  @IsUUID()
  issueId: string;

  @ApiProperty({ 
    description: 'Progress percentage (0-100)', 
    minimum: 0, 
    maximum: 100 
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;

  @ApiProperty({ 
    description: 'Additional hours spent', 
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  spentHours?: number;

  @ApiProperty({ 
    description: 'Progress update notes', 
    required: false 
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProgressBulkUpdateDto {
  @ApiProperty({ 
    description: 'Array of progress updates',
    type: [BulkProgressUpdateItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkProgressUpdateItemDto)
  updates: BulkProgressUpdateItemDto[];
}

export class ProgressBulkResponseDto {
  @ApiProperty({ description: 'Total number of issues processed' })
  totalProcessed: number;

  @ApiProperty({ description: 'Number of successful updates' })
  successCount: number;

  @ApiProperty({ description: 'Number of failed updates' })
  failureCount: number;

  @ApiProperty({ 
    description: 'Results for each issue update attempt',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Issue ID' },
        success: { type: 'boolean', description: 'Whether update succeeded' },
        error: { type: 'string', description: 'Error message if failed' },
        previousProgress: { type: 'number', description: 'Previous progress if successful' },
        newProgress: { type: 'number', description: 'New progress if successful' }
      }
    }
  })
  results: Array<{ 
    id: string; 
    success: boolean; 
    error?: string; 
    previousProgress?: number; 
    newProgress?: number 
  }>;
}