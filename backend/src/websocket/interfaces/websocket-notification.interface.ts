/**
 * WebSocket通知システムのインターフェース定義
 * 
 * 設定変更時のリアルタイム通知を管理する型定義：
 * - 通知イベント種別の列挙
 * - 通知データ構造の標準化
 * - 受け入れ条件: 設定変更時のWebSocket通知配信
 */

/**
 * 通知イベント種別
 * 
 * settings_changed: 休日設定変更時の通知
 * password_changed: 共有パスワード変更時の通知（将来拡張用）
 * reauth_required: 再認証が必要な場合の通知
 */
export type NotificationEvent = 
  | 'settings_changed'        // 休日設定変更
  | 'password_changed'        // 共有パスワード変更
  | 'reauth_required';        // 再認証必要

/**
 * WebSocket通知データ構造
 * 
 * 標準化されたメッセージ形式:
 * - event: 通知の種別を示すイベントタイプ
 * - data: 通知の詳細情報を含むペイロード
 * - timestamp: 通知発生時刻（ISO文字列）
 * - projectId: プロジェクト特定通知用（オプション）
 * - requiresReauth: 再認証要求フラグ（オプション）
 */
export interface WebSocketNotification {
  event: NotificationEvent;
  data: {
    message: string;
    timestamp: string;
    projectId?: string;
    requiresReauth?: boolean;
  };
}

/**
 * 通知対象の種別
 * 
 * ALL: 全セッションに配信
 * PROJECT: 特定プロジェクト参照者に配信
 */
export type NotificationTarget = 'ALL' | 'PROJECT';

/**
 * 通知配信リクエスト
 * 
 * WebSocketGatewayの通知送信メソッドで使用する構造体
 */
export interface NotificationRequest {
  target: NotificationTarget;
  notification: WebSocketNotification;
  projectId?: string;
}