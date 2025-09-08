import { IsArray, ValidateNested, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 単一Issue並び替え項目
 */
export class ReorderIssueItem {
  @ApiProperty({
    description: 'IssueID',
    example: '12345678-1234-1234-1234-123456789012',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: '新しいsort_order',
    example: 10,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  sort_order: number;

  @ApiProperty({
    description: '楽観的排他制御用バージョン',
    example: 5,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  version: number;
}

/**
 * 複数Issue並び替え要求DTO
 * 
 * 用途:
 * - ドラッグ&ドロップによるsort_order一括更新
 * - 楽観的排他制御による競合検出
 * - 同一階層内での並び替えに限定
 * 
 * バリデーション:
 * - issues配列は必須（空配列は無効）
 * - 各アイテムのid, sort_order, versionは必須
 * - sort_orderは0以上の整数
 */
export class ReorderIssuesDto {
  @ApiProperty({
    description: '並び替え対象のIssue一覧',
    type: [ReorderIssueItem],
    example: [
      {
        id: '12345678-1234-1234-1234-123456789012',
        sort_order: 10,
        version: 5,
      },
      {
        id: '12345678-1234-1234-1234-123456789013',
        sort_order: 20,
        version: 3,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderIssueItem)
  issues: ReorderIssueItem[];
}