import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Re-export existing DTOs
export { CreateProjectDto } from './create-project.dto';
export { UpdateProjectDto } from './update-project.dto';

export class ProjectMemberDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Member role', enum: ['owner', 'admin', 'member', 'viewer'] })
  @IsString()
  role: string;

  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export class ProjectResponseDto {
  @ApiProperty({ description: 'Project ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Project name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Project visibility', enum: ['private', 'password', 'public'] })
  @IsString()
  visibility: string;

  @ApiProperty({ description: 'Whether scheduling is enabled' })
  @IsBoolean()
  schedulingEnabled: boolean;

  @ApiProperty({ description: 'Project creation timestamp' })
  @IsString()
  createdAt: string;

  @ApiProperty({ description: 'Project last update timestamp' })
  @IsString()
  updatedAt: string;

  @ApiProperty({ description: 'Project members', type: [ProjectMemberDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberDto)
  members: ProjectMemberDto[];

  @ApiProperty({ description: 'Number of issues in project' })
  @IsNumber()
  issuesCount: number;
}

export class CreateScheduleVersionDto {
  @ApiPropertyOptional({
    description: 'Description of this schedule version',
    example: 'Updated schedule after resource reallocation',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether to set this version as active',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  setAsActive?: boolean = false;
}

export class ScheduleVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  description: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  createdBy: string;
}

export class MigrationStatusDto {
  @ApiProperty()
  isComplete: boolean;

  @ApiProperty()
  pendingMigrations: number;

  @ApiProperty()
  lastMigrationAt: Date | null;
}