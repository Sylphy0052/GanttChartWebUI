import { IsString, MinLength } from 'class-validator';

/**
 * ProjectPasswordAuthDto - プロジェクト共有パスワード認証用DTO
 * 
 * 用途:
 * - プロジェクトの共有パスワード認証
 * - Editor権限の取得
 */
export class ProjectPasswordAuthDto {
  @IsString()
  project_id: string;

  @IsString()
  @MinLength(1, { message: 'パスワードを入力してください' })
  password: string;
}

/**
 * SetProjectPasswordDto - プロジェクト共有パスワード設定用DTO
 * 
 * 用途:
 * - プロジェクトの共有パスワード設定・変更
 */
export class SetProjectPasswordDto {
  @IsString()
  @MinLength(4, { message: 'パスワードは4文字以上で入力してください' })
  password: string;
}