import { ApiProperty } from '@nestjs/swagger';

export class Issue {
  @ApiProperty({
    description: 'Issue ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  id: string;

  @ApiProperty({
    description: 'Project ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  projectId: string;

  @ApiProperty({
    description: 'Parent Issue ID (for hierarchy)',
    example: '01234567-89ab-cdef-0123-456789abcdef',
    nullable: true
  })
  parentIssueId?: string;

  @ApiProperty({
    description: 'Issue title',
    example: 'Implement user authentication'
  })
  title: string;

  @ApiProperty({
    description: 'Issue description',
    example: 'Add JWT-based authentication system'
  })
  description: string;

  @ApiProperty({
    description: 'Issue status',
    enum: ['todo', 'doing', 'blocked', 'review', 'done']
  })
  status: string;

  @ApiProperty({
    description: 'Issue type',
    enum: ['feature', 'bug', 'spike', 'chore']
  })
  type: string;

  @ApiProperty({
    description: 'Issue priority (1-10)',
    minimum: 1,
    maximum: 10,
    example: 5
  })
  priority: number;

  @ApiProperty({
    description: 'Estimate value',
    example: 8
  })
  estimateValue: number;

  @ApiProperty({
    description: 'Estimate unit',
    enum: ['h', 'd']
  })
  estimateUnit: string;

  @ApiProperty({
    description: 'Spent time',
    example: 4
  })
  spent: number;

  @ApiProperty({
    description: 'Assignee ID',
    example: '01234567-89ab-cdef-0123-456789abcdef',
    nullable: true
  })
  assigneeId?: string;

  @ApiProperty({
    description: 'Start date',
    example: '2025-09-05T00:00:00.000Z',
    nullable: true
  })
  startDate?: Date;

  @ApiProperty({
    description: 'Due date',
    example: '2025-09-12T00:00:00.000Z',
    nullable: true
  })
  dueDate?: Date;

  @ApiProperty({
    description: 'Progress percentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 30
  })
  progress: number;

  @ApiProperty({
    description: 'Labels',
    type: [String],
    example: ['frontend', 'authentication']
  })
  labels: string[];

  @ApiProperty({
    description: 'Version for optimistic locking',
    example: 1
  })
  version: number;

  @ApiProperty({
    description: 'Soft delete timestamp',
    example: null,
    nullable: true
  })
  deletedAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-09-05T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-09-05T12:00:00.000Z'
  })
  updatedAt: Date;
}