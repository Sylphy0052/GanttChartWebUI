import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * CreateCommentDto - Comment作成用DTO
 * 
 * バリデーション:
 * - content: 必須、1-5000文字
 * - author: 必須、文字列
 */
export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: 'コメント内容は1文字以上で入力してください' })
  @MaxLength(5000, { message: 'コメント内容は5000文字以下で入力してください' })
  content: string;

  @IsString()
  @MinLength(1, { message: '作成者は1文字以上で入力してください' })
  author: string;
}