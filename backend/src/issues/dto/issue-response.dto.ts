import { Exclude, Expose, Type } from 'class-transformer';

/**
 * IssueResponseDto - Issue応答用DTO
 * 
 * レスポンス用の型安全なデータ転送オブジェクト
 * 階層情報（children）や関連エンティティを含む
 */
export class IssueResponseDto {
  @Expose()
  id: string;

  @Expose()
  project_id: string;

  @Expose()
  parent_id?: string;

  @Expose()
  title: string;

  @Expose()
  description_md?: string;

  @Expose()
  assignee?: string;

  @Expose()
  status: 'open' | 'in_progress' | 'done' | 'blocked';

  @Expose()
  type: 'Task' | 'Milestone';

  @Expose()
  start_date?: Date;

  @Expose()
  end_date?: Date;

  @Expose()
  progress_pct: number;

  @Expose()
  effort_hours?: number;

  @Expose()
  is_blocked: boolean;

  @Expose()
  sort_order: number;

  @Expose()
  labels: string[];

  @Expose()
  version: number;

  @Exclude()
  is_deleted: boolean;

  @Exclude()
  deleted_at?: Date;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;

  // WBS番号（階層構造に基づく自動生成）
  @Expose()
  wbs_number: string;

  // 階層構造サポート用
  @Expose()
  @Type(() => IssueResponseDto)
  children?: IssueResponseDto[];

  @Expose()
  @Type(() => IssueResponseDto)
  parent?: IssueResponseDto;

  constructor(partial: Partial<IssueResponseDto>) {
    Object.assign(this, partial);
  }
}