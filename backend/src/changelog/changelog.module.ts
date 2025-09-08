import { Module } from '@nestjs/common';
import { ChangeLogService } from './changelog.service';
import { DatabaseModule } from '../database/database.module';

/**
 * ChangeLogModule - 変更履歴モジュール
 * 
 * 変更履歴機能に必要な以下を提供:
 * - ChangeLogService（ビジネスロジック）
 * - DatabaseModule（Prismaサービス）のインポート
 */
@Module({
  imports: [DatabaseModule],
  providers: [ChangeLogService],
  exports: [ChangeLogService], // 他のモジュールから利用可能にする
})
export class ChangeLogModule {}