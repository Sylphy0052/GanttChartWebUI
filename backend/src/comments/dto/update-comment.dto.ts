import { PartialType } from '@nestjs/mapped-types';
import { CreateCommentDto } from './create-comment.dto';

/**
 * UpdateCommentDto - Comment更新用DTO
 * 
 * CreateCommentDtoのすべてのフィールドをオプションにして継承
 * 部分更新に対応（PATCH操作用）
 * 更新時にeditedフラグが自動的にtrueに設定される
 */
export class UpdateCommentDto extends PartialType(CreateCommentDto) {}