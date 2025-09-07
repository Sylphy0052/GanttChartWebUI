import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * DatabaseModule - データベース関連サービスの管理
 * 
 * 機能:
 * - PrismaServiceのグローバル提供
 * - データベース接続の一元管理
 * - 他のモジュールでの依存性注入を可能にする
 */
@Global() // グローバルモジュールとして登録（全モジュールで利用可能）
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 他のモジュールから注入可能にする
})
export class DatabaseModule {}