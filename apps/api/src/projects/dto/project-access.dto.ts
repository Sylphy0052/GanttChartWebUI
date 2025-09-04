import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  MinLength,
  MaxLength
} from 'class-validator';

export class ProjectAccessDto {
  @ApiProperty({
    description: 'Project password',
    example: 'mySecretPassword123',
    minLength: 1,
    maxLength: 256
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password: string;
}

export class ProjectPasswordDto {
  @ApiProperty({
    description: 'New project password',
    example: 'myNewSecretPassword123',
    minLength: 1,
    maxLength: 256
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password: string;
}

export class ProjectAccessResponseDto {
  @ApiProperty({
    description: 'Access token for the project',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token expiration timestamp',
    example: 1693886400000
  })
  expiresAt: number;
}