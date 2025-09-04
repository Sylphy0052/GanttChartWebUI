import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Project {
  @ApiProperty({
    description: 'Project ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  id: string;

  @ApiProperty({
    description: 'Project name',
    example: 'My Awesome Project'
  })
  name: string;

  @ApiProperty({
    description: 'Project visibility level',
    enum: ['private', 'password', 'public'],
    example: 'private'
  })
  visibility: string;

  @ApiPropertyOptional({
    description: 'Password hash (not exposed in API responses)',
    nullable: true,
    writeOnly: true
  })
  passwordHash?: string;

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