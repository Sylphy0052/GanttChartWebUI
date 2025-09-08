/**
 * WebSocket通知システムのインターフェース定義
 * 
 * 設定変更・Issue・Comment変更時のリアルタイム通知を管理する型定義：
 * - 通知イベント種別の列挙
 * - 通知データ構造の標準化
 * - 受け入れ条件: 設定変更・Issue・Comment変更時のWebSocket通知配信
 */

/**
 * 通知イベント種別
 * 
 * settings_changed: 休日設定変更時の通知
 * password_changed: 共有パスワード変更時の通知（将来拡張用）
 * reauth_required: 再認証が必要な場合の通知
 * issue_created: Issue作成時の通知
 * issue_updated: Issue更新時の通知
 * issue_deleted: Issue削除時の通知
 * comment_created: Comment作成時の通知
 * comment_updated: Comment更新時の通知
 * comment_deleted: Comment削除時の通知
 */
export type NotificationEvent = 
  | 'settings_changed'        // 休日設定変更
  | 'password_changed'        // 共有パスワード変更
  | 'reauth_required'         // 再認証必要
  | 'issue_created'           // Issue作成
  | 'issue_updated'           // Issue更新
  | 'issue_deleted'           // Issue削除
  | 'comment_created'         // Comment作成
  | 'comment_updated'         // Comment更新
  | 'comment_deleted';        // Comment削除

/**
 * WebSocket通知データ構造
 * 
 * 標準化されたメッセージ形式:
 * - event: 通知の種別を示すイベントタイプ
 * - data: 通知の詳細情報を含むペイロード
 * - timestamp: 通知発生時刻（ISO文字列）
 * - projectId: プロジェクト特定通知用（オプション）
 * - requiresReauth: 再認証要求フラグ（オプション）
 * - entityType: エンティティの種別（Issue・Comment等）
 * - entityId: エンティティのID
 * - entity: エンティティの詳細データ
 */
export interface WebSocketNotification {
  event: NotificationEvent;
  data: {
    message: string;
    timestamp: string;
    projectId?: string;
    requiresReauth?: boolean;
    entityType?: 'issue' | 'comment';
    entityId?: string;
    entity?: any; // Issue・Comment詳細データ
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

/**
 * Issue通知データ構造
 */
export interface IssueNotificationData {
  action: 'create' | 'update' | 'delete';
  issue: {
    id: string;
    title: string;
    description_md?: string;
    assignee?: string;
    status: string;
    start_date?: Date | null;
    end_date?: Date | null;
    progress_pct: number;
    project_id: string;
    parent_id?: string | null;
  };
  author: string;
}

/**
 * Comment通知データ構造
 */
export interface CommentNotificationData {
  action: 'create' | 'update' | 'delete';
  comment: {
    id: string;
    author: string;
    body_md: string;
    issue_id: string;
    edited: boolean;
  };
  issue: {
    id: string;
    title: string;
    project_id: string;
  };
  author: string;
}