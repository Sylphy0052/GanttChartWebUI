import { ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEnum, 
  IsOptional,
  MaxLength
} from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: 'Project name',
    example: 'Updated Project Name',
    maxLength: 256
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  name?: string;

  @ApiPropertyOptional({
    description: 'Project visibility level',
    enum: ['private', 'password', 'public'],
    example: 'password'
  })
  @IsOptional()
  @IsEnum(['private', 'password', 'public'])
  visibility?: string;
}