import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEnum, 
  IsOptional,
  MaxLength
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'My Awesome Project',
    maxLength: 256
  })
  @IsString()
  @MaxLength(256)
  name: string;

  @ApiPropertyOptional({
    description: 'Project visibility level',
    enum: ['private', 'password', 'public'],
    example: 'private',
    default: 'private'
  })
  @IsOptional()
  @IsEnum(['private', 'password', 'public'])
  visibility?: string = 'private';
}