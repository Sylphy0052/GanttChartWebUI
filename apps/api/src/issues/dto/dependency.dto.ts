import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsUUID } from 'class-validator';

export class CreateDependencyDto {
  @ApiProperty({ 
    description: 'Successor issue ID (the issue that depends on the predecessor)',
    example: 'uuid-successor-issue'
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  successorId: string;

  @ApiProperty({ 
    description: 'Dependency type - currently only FS (Finish-to-Start) is supported',
    enum: ['FS'],
    default: 'FS'
  })
  @IsOptional()
  @IsEnum(['FS'])
  type?: 'FS' = 'FS';

  @ApiProperty({ 
    description: 'Lag time in hours (default: 0)',
    example: 0,
    default: 0
  })
  @IsOptional()
  @IsNumber()
  lag?: number = 0;
}

export class DependencyResponseDto {
  @ApiProperty({ description: 'Dependency ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Predecessor issue ID' })
  predecessorId: string;

  @ApiProperty({ description: 'Successor issue ID' })
  successorId: string;

  @ApiProperty({ description: 'Dependency type', enum: ['FS'] })
  type: string;

  @ApiProperty({ description: 'Lag time in hours' })
  lag: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Update timestamp' })
  updatedAt: string;
}

export class DeleteDependencyDto {
  @ApiProperty({ 
    description: 'Successor issue ID to remove dependency for',
    example: 'uuid-successor-issue'
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  successorId: string;
}