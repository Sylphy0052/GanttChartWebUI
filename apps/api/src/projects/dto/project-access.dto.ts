import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  MinLength,
  MaxLength,
  Matches,
  IsOptional
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

  @ApiProperty({
    description: 'Admin override token for emergency access',
    example: 'override_token_abc123',
    required: false
  })
  @IsOptional()
  @IsString()
  overrideToken?: string;
}

export class ProjectPasswordDto {
  @ApiProperty({
    description: 'New project password - minimum 8 characters with mixed case, numbers, and special characters',
    example: 'MySecurePassword123!',
    minLength: 8,
    maxLength: 256
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(256)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)'
    }
  )
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

  @ApiProperty({
    description: 'Refresh token for extending session',
    example: 'refresh_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false
  })
  refreshToken?: string;

  @ApiProperty({
    description: 'Refresh token expiration timestamp',
    example: 1693972800000,
    required: false
  })
  refreshExpiresAt?: number;
}

export class TokenRefreshDto {
  @ApiProperty({
    description: 'Refresh token to get new access token',
    example: 'refresh_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  @MinLength(1)
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty({
    description: 'Access token to blacklist',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  @MinLength(1)
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token to blacklist',
    example: 'refresh_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class AdminOverrideDto {
  @ApiProperty({
    description: 'Reason for emergency access override',
    example: 'Customer support requested access for urgent bug fix'
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    description: 'Override expiration in hours (default: 24)',
    example: 24,
    required: false
  })
  @IsOptional()
  expirationHours?: number;
}