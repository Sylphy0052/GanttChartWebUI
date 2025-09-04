import { ApiProperty } from '@nestjs/swagger';
import { Issue } from '../entities/issue.entity';

export class IssueResponseDto extends Issue {}

export class PaginatedIssueResponseDto {
  @ApiProperty({
    description: 'Issues list',
    type: [IssueResponseDto]
  })
  items: IssueResponseDto[];

  @ApiProperty({
    description: 'Total count',
    example: 1250
  })
  total: number;

  @ApiProperty({
    description: 'Next cursor for pagination',
    example: 'eyJpZCI6IjAxMjM0NTY3LTg5YWItY2RlZi0wMTIzLTQ1Njc4OWFiY2RlZiJ9',
    nullable: true
  })
  nextCursor: string | null;

  @ApiProperty({
    description: 'Has more items',
    example: true
  })
  hasMore: boolean;
}

export class BulkOperationResponseDto {
  @ApiProperty({
    description: 'Number of successful operations',
    example: 5
  })
  successCount: number;

  @ApiProperty({
    description: 'Number of failed operations',
    example: 0
  })
  errorCount: number;

  @ApiProperty({
    description: 'Error details',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        error: { type: 'string' }
      }
    }
  })
  errors: Array<{
    id: string;
    error: string;
  }>;
}