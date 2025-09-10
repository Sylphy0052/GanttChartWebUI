import { IsString, IsEnum, IsOptional } from 'class-validator';

/**
 * CreateDependencyDto - 依存関係作成用DTO
 * 
 * バリデーション:
 * - predecessor_issue_id: 必須、先行Issue ID
 * - successor_issue_id: 必須、後続Issue ID
 * - type: オプショナル、依存関係タイプ（デフォルト: FS）
 */
export class CreateDependencyDto {
  @IsString({ message: '先行Issue IDは文字列で入力してください' })
  predecessor_issue_id: string;

  @IsString({ message: '後続Issue IDは文字列で入力してください' })
  successor_issue_id: string;

  @IsOptional()
  @IsEnum(['FS'], { 
    message: '依存関係タイプは FS (Finish-to-Start) を指定してください' 
  })
  type?: 'FS';
}