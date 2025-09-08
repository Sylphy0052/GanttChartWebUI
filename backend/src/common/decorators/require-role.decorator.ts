import { SetMetadata } from '@nestjs/common';

/**
 * 権限レベルの定義
 */
export type Role = 'viewer' | 'editor';

/**
 * RoleGuardで使用するメタデータキー
 */
export const ROLES_KEY = 'roles';

/**
 * 必要な権限レベルを指定するデコレーター
 * 
 * 使用例:
 * @RequireRole('editor')  // Editor権限が必要
 * @RequireRole('viewer')  // Viewer権限が必要（デフォルト）
 * 
 * 権限レベル:
 * - viewer: 閲覧権限（デフォルト）
 * - editor: 編集権限（viewerを含む）
 * 
 * @param role 必要な権限レベル
 */
export const RequireRole = (role: Role) => SetMetadata(ROLES_KEY, role);