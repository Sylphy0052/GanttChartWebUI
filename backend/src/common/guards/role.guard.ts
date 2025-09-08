import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from '../../auth/auth.middleware';
import { Role, ROLES_KEY } from '../decorators/require-role.decorator';

/**
 * RoleGuard - 権限管理ガード
 * 
 * 機能:
 * - ユーザーの権限レベル（viewer/editor）を検証
 * - @RequireRole デコレーターで指定された必要権限との比較
 * - 権限不足の場合は403 Forbiddenエラーを返却
 * - 適切なログ出力とエラーメッセージ
 * 
 * 権限レベル:
 * - viewer: 閲覧権限（GET系APIのみ実行可能）
 * - editor: 編集権限（全てのAPIを実行可能、viewerを包含）
 * 
 * 使用方法:
 * 1. コントローラーまたはメソッドに @RequireRole('editor') を追加
 * 2. このガードをコントローラーに適用: @UseGuards(RoleGuard)
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(private reflector: Reflector) {}

  /**
   * 権限チェック実行
   * @param context 実行コンテキスト
   * @returns 権限チェック結果
   */
  canActivate(context: ExecutionContext): boolean {
    // メタデータから必要な権限レベルを取得
    const requiredRole = this.reflector.getAllAndOverride<Role>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @RequireRole が指定されていない場合は通す（デフォルトでviewer扱い）
    if (!requiredRole) {
      this.logger.debug('No role requirement specified, allowing access');
      return true;
    }

    // リクエストからユーザー情報を取得
    const request = context.switchToHttp().getRequest<Request>();
    const user: AuthUser | undefined = request.user;

    // ユーザー情報がない場合（認証ミドルウェアが未実行）
    if (!user) {
      this.logger.warn('No user information found in request');
      throw new ForbiddenException({
        message: '認証が必要です',
        details: 'User authentication required',
        statusCode: 403,
      });
    }

    // 権限チェック実行
    const hasPermission = this.checkPermission(user.permission, requiredRole);
    
    if (!hasPermission) {
      this.logger.warn(
        `Access denied: User has '${user.permission}' permission but '${requiredRole}' is required. ` +
        `User type: ${user.type}, Project ID: ${user.project_id || 'N/A'}`
      );
      
      throw new ForbiddenException({
        message: this.getPermissionErrorMessage(requiredRole, user.permission),
        details: `Required: ${requiredRole}, Current: ${user.permission}`,
        statusCode: 403,
      });
    }

    this.logger.log(
      `Access granted: User has '${user.permission}' permission for '${requiredRole}' requirement. ` +
      `User type: ${user.type}, Project ID: ${user.project_id || 'N/A'}`
    );

    return true;
  }

  /**
   * 権限レベルをチェック
   * @param userPermission ユーザーの権限
   * @param requiredRole 必要な権限
   * @returns チェック結果
   */
  private checkPermission(userPermission: string, requiredRole: Role): boolean {
    // 権限階層: editor > viewer
    switch (requiredRole) {
      case 'viewer':
        // viewerは全てのユーザーがアクセス可能
        return userPermission === 'viewer' || userPermission === 'editor';
      
      case 'editor':
        // editorはeditor権限を持つユーザーのみアクセス可能
        return userPermission === 'editor';
      
      default:
        this.logger.error(`Unknown required role: ${requiredRole}`);
        return false;
    }
  }

  /**
   * 権限不足時のエラーメッセージを生成
   * @param requiredRole 必要な権限
   * @param userPermission ユーザーの権限
   * @returns エラーメッセージ
   */
  private getPermissionErrorMessage(requiredRole: Role, userPermission: string): string {
    switch (requiredRole) {
      case 'editor':
        return 'この操作には編集権限が必要です。プロジェクトパスワードを入力してください。';
      
      case 'viewer':
        return 'この操作には閲覧権限が必要です。';
      
      default:
        return '権限が不足しています。';
    }
  }
}