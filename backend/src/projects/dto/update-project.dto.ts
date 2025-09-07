import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';

/**
 * UpdateProjectDto - プロジェクト更新用DTO
 * 
 * CreateProjectDtoのすべてのフィールドをオプションにして継承
 * 部分更新に対応（PATCH操作用）
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}