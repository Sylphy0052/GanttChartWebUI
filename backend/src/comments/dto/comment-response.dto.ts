import { Exclude, Expose } from 'class-transformer';

/**
 * CommentResponseDto - Comment応答用DTO
 * 
 * レスポンス用の型安全なデータ転送オブジェクト
 * edited状態や作成・更新日時を含む
 */
export class CommentResponseDto {
  @Expose()
  id: string;

  @Expose()
  issue_id: string;

  @Expose()
  author: string;

  @Expose()
  body_md: string;

  @Expose()
  edited: boolean;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;

  constructor(partial: Partial<CommentResponseDto>) {
    Object.assign(this, partial);
  }
}