import { Expose } from 'class-transformer';
import { ChangeEntityType } from '@prisma/client';

/**
 * ChangeLogResponseDto - 変更履歴レスポンスDTO
 * 
 * 機能:
 * - ChangeLogエンティティのレスポンス形式を定義
 * - diff_jsonをオブジェクトとして型安全に処理
 * - APIレスポンス時の変換を制御
 */
export class ChangeLogResponseDto {
  @Expose()
  id: string;

  @Expose()
  entity_type: ChangeEntityType;

  @Expose()
  entity_id: string;

  @Expose()
  project_id: string | null;

  @Expose()
  diff_json: Record<string, any>;

  @Expose()
  user_hint: string | null;

  @Expose()
  created_at: Date;
}