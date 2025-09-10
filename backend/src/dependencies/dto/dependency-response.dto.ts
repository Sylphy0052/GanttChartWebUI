import { Expose } from 'class-transformer';

/**
 * DependencyResponseDto - 依存関係応答用DTO
 * 
 * レスポンス用の型安全なデータ転送オブジェクト
 * 先行・後続IssueのタイトルやID情報を含む
 */
export class DependencyResponseDto {
  @Expose()
  id: string;

  @Expose()
  project_id: string;

  @Expose()
  predecessor_issue_id: string;

  @Expose()
  successor_issue_id: string;

  @Expose()
  type: 'FS';

  @Expose()
  created_at: Date;

  // 関連Issue情報（レスポンスに含める場合）
  @Expose()
  predecessor?: {
    id: string;
    title: string;
  };

  @Expose()
  successor?: {
    id: string;
    title: string;
  };

  constructor(partial: Partial<DependencyResponseDto>) {
    Object.assign(this, partial);
  }
}