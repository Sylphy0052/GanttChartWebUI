import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
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
import { CreateIssueDto } from './create-issue.dto';

export class UpdateIssueDto extends PartialType(CreateIssueDto) {
  @ApiPropertyOptional({
    description: 'Version for optimistic locking',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  version?: number;
}

export class MoveIssueDto {
  @ApiPropertyOptional({
    description: 'New parent Issue ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsOptional()
  @IsUUID()
  parentIssueId?: string;

  @ApiPropertyOptional({
    description: 'Sort index within parent',
    example: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortIndex?: number;
}

export class BulkUpdateIssueDto {
  @ApiPropertyOptional({
    description: 'Operation type',
    enum: ['update', 'move', 'delete'],
    example: 'update'
  })
  @IsOptional()
  @IsEnum(['update', 'move', 'delete'])
  operation?: string;

  @ApiPropertyOptional({
    description: 'Issue ID',
    example: '01234567-89ab-cdef-0123-456789abcdef'
  })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({
    description: 'Update fields',
    type: 'object'
  })
  @IsOptional()
  fields?: Partial<UpdateIssueDto>;
}