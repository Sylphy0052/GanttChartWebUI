import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * CreateCommentDto - Comment作成用DTO
 * 
 * バリデーション:
 * - body_md: 必須、1-5000文字（Markdown形式のコメント内容）
 */
export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: 'コメント内容は1文字以上で入力してください' })
  @MaxLength(5000, { message: 'コメント内容は5000文字以下で入力してください' })
  body_md: string;
}