import { PartialType } from '@nestjs/mapped-types';
import { CreateIssueDto } from './create-issue.dto';

/**
 * UpdateIssueDto - Issue更新用DTO
 * 
 * CreateIssueDtoのすべてのフィールドをオプションにして継承
 * 部分更新に対応（PATCH操作用）
 */
export class UpdateIssueDto extends PartialType(CreateIssueDto) {}