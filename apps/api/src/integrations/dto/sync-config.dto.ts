import { IsObject, IsString, IsBoolean, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum IssueStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export class ProjectMappingDto {
  @ApiProperty({ 
    description: 'Repository name to project ID mapping',
    example: { 'my-repo': 'proj-123', 'another-repo': 'proj-456' }
  })
  @IsObject()
  projectMapping: { [repositoryName: string]: string };
}

export class StatusMappingDto {
  @ApiProperty({ 
    description: 'External status to internal status mapping',
    example: { 'open': 'todo', 'in-progress': 'in_progress', 'closed': 'done' }
  })
  @IsObject()
  statusMapping: { [externalStatus: string]: IssueStatus };
}

export class DefaultOptionsDto {
  @ApiProperty({ 
    description: 'Fallback user ID when external user not found',
    example: 'system-user-123'
  })
  @IsString()
  fallbackUserId: string;

  @ApiProperty({ 
    description: 'Default status for unknown external statuses',
    enum: IssueStatus,
    example: IssueStatus.TODO
  })
  @IsEnum(IssueStatus)
  defaultStatus: IssueStatus;

  @ApiPropertyOptional({ 
    description: 'Enable automatic user creation for unknown emails',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  enableAutoUserCreation?: boolean;
}

export class SyncConfigurationDto {
  @ApiProperty({ type: ProjectMappingDto })
  @ValidateNested()
  @Type(() => ProjectMappingDto)
  projectMapping: ProjectMappingDto;

  @ApiProperty({ type: StatusMappingDto })
  @ValidateNested()
  @Type(() => StatusMappingDto)
  statusMapping: StatusMappingDto;

  @ApiProperty({ type: DefaultOptionsDto })
  @ValidateNested()
  @Type(() => DefaultOptionsDto)
  defaultOptions: DefaultOptionsDto;
}