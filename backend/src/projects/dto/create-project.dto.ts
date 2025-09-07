import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

/**
 * CreateProjectDto - プロジェクト作成用DTO
 * 
 * バリデーション:
 * - name: 必須、3-100文字、ユニーク制約はサービス層で処理
 * - description_md: オプショナル、最大10000文字
 * - shared_password_hash: オプショナル、暗号化済みパスワード
 */
export class CreateProjectDto {
  @IsString()
  @MinLength(3, { message: 'プロジェクト名は3文字以上で入力してください' })
  @MaxLength(100, { message: 'プロジェクト名は100文字以下で入力してください' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000, { message: '説明は10000文字以下で入力してください' })
  description_md?: string;

  @IsOptional()
  @IsString()
  shared_password_hash?: string;
}