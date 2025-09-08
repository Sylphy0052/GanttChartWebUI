import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Issue階層変更要求DTO
 * 
 * 用途:
 * - 親子関係の変更（parent_id更新）
 * - 楽観的排他制御による競合検出
 * - 循環参照の防止
 * 
 * バリデーション:
 * - new_parent_idはオプション（nullで親なしに変更可能）
 * - versionは楽観的排他制御用（必須）
 * 
 * 制約:
 * - 同一プロジェクト内のIssueのみ親として設定可能
 * - 自分自身を親に設定することは不可
 * - 循環参照の生成は不可
 */
export class ChangeHierarchyDto {
  @ApiProperty({
    description: '新しい親IssueのID（nullで親なし）',
    example: '12345678-1234-1234-1234-123456789012',
    required: false,
  })
  @IsOptional()
  @IsString()
  new_parent_id?: string | null;

  @ApiProperty({
    description: '楽観的排他制御用バージョン',
    example: 5,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  version: number;
}