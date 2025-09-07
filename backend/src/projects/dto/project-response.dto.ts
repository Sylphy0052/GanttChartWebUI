import { Exclude, Expose } from 'class-transformer';

/**
 * ProjectResponseDto - プロジェクト応答用DTO
 * 
 * レスポンス用の型安全なデータ転送オブジェクト
 * センシティブな情報（shared_password_hash）は除外
 */
export class ProjectResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description_md?: string;

  @Exclude()
  shared_password_hash?: string;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;

  @Exclude()
  is_deleted: boolean;

  constructor(partial: Partial<ProjectResponseDto>) {
    Object.assign(this, partial);
  }
}