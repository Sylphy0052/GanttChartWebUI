import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for updating issue parent
 */
export class UpdateParentDto {
  @ApiPropertyOptional({
    description: 'New parent Issue ID (null to move to root level)',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsOptional()
  @IsUUID()
  parentIssueId?: string | null;
}

/**
 * DTO for reordering issues within same parent
 */
export class ReorderIssuesDto {
  @ApiProperty({
    description: 'Array of issue orders within the same parent',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        issueId: { type: 'string', format: 'uuid' },
        orderIndex: { type: 'number', minimum: 0 }
      }
    },
    example: [
      { issueId: '01234567-89ab-cdef-0123-456789abcdef', orderIndex: 0 },
      { issueId: '11234567-89ab-cdef-0123-456789abcdef', orderIndex: 1 }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueOrderDto)
  orders: IssueOrderDto[];
}

export class IssueOrderDto {
  @ApiProperty({
    description: 'Issue ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsUUID()
  issueId: string;

  @ApiProperty({
    description: 'Order index (0-based)',
    example: 0
  })
  @IsNumber()
  @Min(0)
  orderIndex: number;
}

/**
 * Response DTO for successful update operations
 */
export class WBSUpdateResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Issue parent updated successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Updated issue ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  issueId: string;

  @ApiProperty({
    description: 'New hierarchy level',
    example: 2
  })
  level: number;
}

/**
 * Response DTO for reorder operations
 */
export class WBSReorderResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Issues reordered successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Number of issues updated',
    example: 3
  })
  updatedCount: number;

  @ApiProperty({
    description: 'Parent Issue ID (null for root level)',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  parentIssueId: string | null;
}