# WebSocket通知機能ロールバック計画書

## タスク概要
- **タスクID**: m3-websocket-notification
- **タイトル**: 設定変更WebSocket通知実装
- **実装日時**: 2025-09-07 19:25 JST

## 実装内容

### 新規作成ファイル
1. `/src/websocket/interfaces/websocket-notification.interface.ts`
2. `/src/websocket/websocket.gateway.ts`
3. `/src/websocket/websocket.module.ts`

### 更新ファイル
1. `/src/settings/settings.service.ts` - WebSocket通知統合
2. `/src/settings/settings.module.ts` - WebSocketModule依存追加
3. `/src/app.module.ts` - WebSocketModule追加
4. `package.json` - WebSocket関連依存関係追加

## ロールバック手順

### ステップ1: 依存関係の削除
```bash
npm uninstall @nestjs/websockets @nestjs/platform-socket.io socket.io socket.io-client
```

### ステップ2: ソースコードのロールバック

#### 2.1 settings.service.ts の復元
```typescript
// WebSocket関連のimportと機能を削除
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { HolidaySettingsResponseDto, UpdateHolidaySettingsDto } from './dto';
// import { NotificationGateway } from '../websocket/websocket.gateway'; ← 削除

// constructor を元の状態に戻す
constructor(private readonly prisma: PrismaService) {}

// updateHolidaySettings メソッドから WebSocket通知部分を削除
// - sendSettingsChangeNotification の呼び出し削除
// - WebSocket関連のtry-catch削除
```

#### 2.2 settings.module.ts の復元
```typescript
import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
// import { WebSocketModule } from '../websocket/websocket.module'; ← 削除

@Module({
  // imports: [WebSocketModule], ← 削除
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```

#### 2.3 app.module.ts の復元
```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ProjectsModule } from './projects/projects.module';
import { SettingsModule } from './settings/settings.module';
// import { WebSocketModule } from './websocket/websocket.module'; ← 削除
import { HealthController } from './health/health.controller';
import { AuthMiddleware } from './auth/auth.middleware';

@Module({
  imports: [
    DatabaseModule,
    ProjectsModule,
    SettingsModule,
    // WebSocketModule, ← 削除
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuthMiddleware)
      .exclude('/health')
      .forRoutes('*');
  }
}
```

### ステップ3: WebSocketディレクトリの削除
```bash
rm -rf src/websocket/
```

### ステップ4: テストファイルの削除
```bash
rm -f test-websocket-notification*.js
rm -f simple-websocket-test.js
```

### ステップ5: アプリケーションの再起動
```bash
npm run build
npm run start:dev
```

### ステップ6: 動作確認
```bash
# 基本API動作確認
curl -X GET http://localhost:3000/health
curl -X GET http://localhost:3000/settings/holidays \
  -H "Authorization: test-password-2024"

curl -X PATCH http://localhost:3000/settings/holidays \
  -H "Content-Type: application/json" \
  -H "Authorization: test-password-2024" \
  -d '{"weekend_off": true, "holiday_dates": ["2024-12-25"]}'
```

## リスク評価

### 低リスク
- WebSocket機能は新規追加機能のため、既存機能への影響は最小限
- 設定変更API自体の動作は維持される
- データベース構造に変更なし

### 潜在的問題
- WebSocket依存関係がある場合の型エラー
- モジュール間の循環依存がある場合のビルドエラー

## 検証手順

### 1. ビルドエラーチェック
```bash
npm run build
```

### 2. 基本機能テスト
- 設定取得API
- 設定更新API
- プロジェクトCRUD API
- ヘルスチェック

### 3. 認証・権限機能テスト
```bash
# 認証失敗確認
curl -X GET http://localhost:3000/settings/holidays

# 認証成功確認
curl -X GET http://localhost:3000/settings/holidays \
  -H "Authorization: test-password-2024"
```

## 代替実装案（最小限）

WebSocket機能を完全に削除せず、最小限の実装に変更する場合：

### 1. NotificationGateway の無効化
```typescript
// websocket.gateway.ts で全メソッドを空実装に変更
async notifySettingsChanged(): Promise<void> {
  // 空実装 - 通知機能を無効化
  return;
}
```

### 2. SettingsService でのエラーハンドリング強化
```typescript
try {
  await this.notificationGateway.notifySettingsChanged(message);
} catch (error) {
  // 通知失敗を無視して継続
  this.logger.warn('WebSocket notification disabled or failed', error);
}
```

## 復旧時間見積もり
- **完全ロールバック**: 15-20分
- **最小限実装**: 5-10分
- **検証時間**: 10-15分

## 連絡先
- **実装担当**: Claude Code Assistant
- **確認者**: プロジェクト担当者
- **承認者**: システム管理者

## 注意事項
1. ロールバック前に現在の実装を別途保存しておく
2. 本番環境では段階的にロールバックを実行する
3. WebSocket接続中のクライアントがある場合は事前に通知する
4. package.json の変更後は npm install を実行する

---

**作成日**: 2025-09-07  
**更新日**: 2025-09-07  
**バージョン**: 1.0