import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AssignIssueToUserDto {
  @ApiProperty({
    description: 'Issue ID to assign the user to',
    example: '12345678-1234-1234-1234-123456789abc'
  })
  @IsString()
  @IsUUID()
  issueId: string;
}