import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * CreateImageUploadDto - 画像アップロードリクエスト用DTO
 * 
 * 機能:
 * - 画像アップロード時の追加メタデータを受け取り
 * - 代替テキスト（alt_text）のバリデーション
 * - オプション項目の適切な処理
 * 
 * バリデーション:
 * - alt_text: 最大200文字、オプション
 */
export class CreateImageUploadDto {
  /**
   * 代替テキスト（アクセシビリティ用）
   * @example "プロジェクトガントチャートのスクリーンショット"
   */
  @IsOptional()
  @IsString({
    message: '代替テキストは文字列で入力してください',
  })
  @MaxLength(200, {
    message: '代替テキストは200文字以内で入力してください',
  })
  alt_text?: string;
}