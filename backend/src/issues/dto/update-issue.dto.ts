import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsNumber } from 'class-validator';
import { CreateIssueDto } from './create-issue.dto';

/**
 * UpdateIssueDto - Issue更新用DTO
 *
 * CreateIssueDtoのすべてのフィールドをオプションにして継承
 * 部分更新に対応（PATCH操作用）
 */
export class UpdateIssueDto extends PartialType(CreateIssueDto) {
  @IsOptional()
  @IsNumber({}, { message: 'バージョンは数値で入力してください' })
  version?: number;
}