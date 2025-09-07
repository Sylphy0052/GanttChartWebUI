# マイグレーション ロールバック手順書

## 概要
初回マイグレーション実行とスキーマ適用のロールバック手順を記載します。

## ロールバック実行前の確認事項

### 1. 現在の状態確認
```bash
# マイグレーション履歴確認
npx prisma migrate status

# データベース接続確認
npx prisma db push --preview-feature

# テーブル一覧確認
npx prisma studio
```

### 2. データバックアップ（PostgreSQL の場合）
```bash
# 現在のデータベース全体をバックアップ
pg_dump -h localhost -U gantt_user -d gantt_db > backup_$(date +%Y%m%d_%H%M%S).sql

# または特定テーブルのみ
pg_dump -h localhost -U gantt_user -d gantt_db -t projects -t issues -t comments -t dependencies -t change_logs -t image_paths -t global_settings > tables_backup_$(date +%Y%m%d_%H%M%S).sql
```

## ロールバック手順

### Option 1: データベースリセット（完全ロールバック）

#### PostgreSQL の場合
```bash
# 1. データベース全体削除
dropdb -h localhost -U gantt_user gantt_db

# 2. データベース再作成
createdb -h localhost -U gantt_user gantt_db

# 3. マイグレーション履歴リセット
rm -rf prisma/migrations/

# 4. Prisma Client 再生成
npx prisma generate
```

#### SQLite の場合
```bash
# 1. データベースファイル削除
rm -f prisma/dev.db
rm -f prisma/test.db

# 2. マイグレーション履歴リセット
rm -rf prisma/migrations/

# 3. Prisma Client 再生成
npx prisma generate
```

### Option 2: 特定テーブルのみ削除

#### PostgreSQL の場合
```sql
-- PostgreSQL に接続
psql -h localhost -U gantt_user -d gantt_db

-- 外部キー制約を考慮してテーブルを削除
DROP TABLE IF EXISTS image_paths CASCADE;
DROP TABLE IF EXISTS change_logs CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS dependencies CASCADE;
DROP TABLE IF EXISTS issues CASCADE;
DROP TABLE IF EXISTS global_settings CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- enum型も削除（存在する場合）
DROP TYPE IF EXISTS "IssueStatus" CASCADE;
DROP TYPE IF EXISTS "DependencyType" CASCADE;
DROP TYPE IF EXISTS "ChangeEntityType" CASCADE;
```

#### SQLite の場合
```bash
# SQLite に接続（sqlite3 がインストールされている場合）
sqlite3 prisma/dev.db

# テーブル削除
DROP TABLE IF EXISTS image_paths;
DROP TABLE IF EXISTS change_logs;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS dependencies;
DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS global_settings;
DROP TABLE IF EXISTS projects;
```

### Option 3: スキーマ復元（スキーマのみ変更したい場合）

```bash
# 1. バックアップからスキーマ復元
cp prisma/schema.prisma.backup prisma/schema.prisma

# 2. 現在の状態とスキーマを同期
npx prisma db push --accept-data-loss

# 3. Prisma Client 再生成
npx prisma generate
```

## ファイルの復元

### 1. 生成されたファイルの削除
```bash
# マイグレーションファイルの削除
rm -rf prisma/migrations/

# テスト用データベースファイルの削除
rm -f prisma/dev.db
rm -f prisma/test.db
rm -f prisma/dev.db-journal

# 生成したスクリプトの削除（必要に応じて）
rm -f verify-migration.js
rm -f scripts/deploy-migration.sh
```

### 2. バックアップファイルから復元
```bash
# スキーマファイル復元
if [ -f prisma/schema.prisma.backup ]; then
    mv prisma/schema.prisma.backup prisma/schema.prisma
fi
```

## ロールバック後の検証

### 1. スキーマ検証
```bash
# スキーマの構文チェック
npx prisma validate

# フォーマット確認
npx prisma format
```

### 2. データベース状態確認
```bash
# データベース接続テスト
npx prisma db push --preview-feature

# Prisma Client 生成テスト
npx prisma generate
```

### 3. アプリケーション動作確認
```bash
# アプリケーションの起動テスト
npm run start:dev

# または
npm test
```

## 緊急時の対応

### データ損失が発生した場合
1. すぐにアプリケーションを停止
2. バックアップからデータベース全体を復元:
   ```bash
   # PostgreSQL の場合
   psql -h localhost -U gantt_user -d gantt_db < backup_YYYYMMDD_HHMMSS.sql
   ```

### 接続エラーが発生した場合
1. DATABASE_URL の設定確認
2. データベースサーバーの起動状況確認
3. 認証情報の確認

## 予防策

### 今後のマイグレーション実行時
1. 必ず本番データのバックアップを取得
2. ステージング環境での事前テスト
3. マイグレーション実行前後の状態記録
4. ロールバック手順の事前準備

### 監視項目
- データベース接続状況
- テーブル構造の整合性
- アプリケーションの動作状況
- パフォーマンスの変化

## 連絡先・エスカレーション
- 問題が解決しない場合は、開発チームに連絡
- 重大な問題の場合は、すぐにサービス停止を検討

---
**注意事項:**
- ロールバック作業は慎重に実行してください
- 本番環境での作業前には必ずステージング環境でテストしてください  
- データの損失リスクがあるため、必ずバックアップを取得してから実行してください