import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { PrismaService } from '../database/prisma.service';

/**
 * UploadsModule - 画像アップロード機能のモジュール
 * 
 * 機能:
 * - UploadsController: 画像アップロードREST API
 * - UploadsService: 画像アップロード・管理ビジネスロジック
 * - PrismaServiceの依存性注入
 * - 画像アップロード機能の統合
 * 
 * エンドポイント:
 * - POST /issues/:issueId/images - 画像アップロード [Editor権限]
 * - GET /images/:id - 画像取得（オリジナル・サムネイル対応）
 * - DELETE /images/:id - 画像削除 [Editor権限]
 * - GET /issues/:issueId/images - Issue別画像一覧取得 [Viewer権限]
 */
@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    PrismaService,
  ],
  exports: [UploadsService],
})
export class UploadsModule {}