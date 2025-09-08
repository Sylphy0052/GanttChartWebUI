/**
 * UploadResponseDto - 画像アップロード結果のレスポンスDTO
 * 
 * 機能:
 * - 画像アップロード成功時のレスポンス構造定義
 * - ImagePathエンティティの情報をクライアントに返却
 * - サムネイル情報を含む包括的な画像情報
 */
export class UploadResponseDto {
  /**
   * 画像パスID
   */
  id: string;

  /**
   * 関連するIssueID
   */
  issue_id: string;

  /**
   * 元ファイルのパス
   */
  file_path: string;

  /**
   * 代替テキスト
   */
  alt_text?: string | null;

  /**
   * アップロード日時
   */
  uploaded_at: Date;

  /**
   * サムネイル情報（複数サイズ）
   */
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  };

  /**
   * 元画像の基本情報
   */
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
  };
}