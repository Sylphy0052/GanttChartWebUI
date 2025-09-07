# ガントチャートWebUI 操作マニュアル

## 📋 目次

1. [システム概要](#システム概要)
2. [アクセス方法](#アクセス方法)
3. [ログイン・認証](#ログイン認証)
4. [基本操作](#基本操作)
5. [プロジェクト管理](#プロジェクト管理)
6. [Issue管理](#issue管理)
7. [WBS（作業分解構造）](#wbs作業分解構造)
8. [ガントチャート](#ガントチャート)
9. [API利用](#api利用)
10. [トラブルシューティング](#トラブルシューティング)

---

## システム概要

ガントチャートWebUIは、Issue管理とガントチャート可視化を統合した軽量プロジェクト管理ツールです。

### 主な機能
- **Issue管理**: タスクの作成、編集、ステータス管理
- **WBSツリー**: 階層的な作業分解構造
- **ガントチャート**: 時系列での進捗可視化
- **依存関係管理**: タスク間の依存関係設定
- **プロジェクト管理**: 複数プロジェクトの管理
- **パフォーマンス監視**: システム性能の監視

---

## アクセス方法

### 🌐 WebUI（推奨）
```
http://localhost:3000
```

### 📊 API文書（開発者向け）
```
http://localhost:3001/api/docs
```

### 🔍 システム状態確認
```bash
# Web健全性チェック
curl http://localhost:3000/api/health

# API健全性チェック  
curl http://localhost:3001/health
```

---

## ログイン・認証

### デモアカウント

システムには以下のデモアカウントが用意されています：

| 役割 | メールアドレス | パスワード | 権限 |
|------|---------------|-----------|------|
| **管理者** | admin@example.com | admin123 | 全権限 |
| **一般ユーザー** | user@example.com | user123 | 標準権限 |
| **デモユーザー** | demo@example.com | demo123 | 読み取り専用 |

### ログイン手順

1. ホームページ（`http://localhost:3000`）にアクセス
2. 「ログイン」リンクをクリック
3. 上記のデモアカウントでログイン
4. ダッシュボードが表示されます

---

## 基本操作

### ナビゲーション

システムには以下の主要セクションがあります：

- **プロジェクトビュー**: WBS + ガントチャートの統合ビュー
- **Issue一覧**: すべてのタスクの一覧表示
- **WBSツリー**: 階層構造での作業分解表示

### 操作の基本フロー

1. **プロジェクト選択**: 作業対象のプロジェクトを選択
2. **Issue作成**: 具体的なタスクを作成
3. **WBS構築**: タスクを階層的に整理
4. **依存関係設定**: タスク間の順序関係を定義
5. **ガントチャート確認**: 時系列で進捗を可視化

---

## プロジェクト管理

### プロジェクトの作成

1. ダッシュボードから「新規プロジェクト作成」をクリック
2. 必須情報を入力：
   - プロジェクト名
   - 説明
   - 開始日・終了日
   - 可視性設定（公開/非公開）

### プロジェクト設定

- **メンバー管理**: チームメンバーの追加・削除
- **権限設定**: 役割ベースのアクセス制御
- **スケジューリング**: 自動スケジューリングの有効/無効

---

## Issue管理

### Issueの作成

1. Issue一覧ページにアクセス
2. 「新規Issue作成」ボタンをクリック
3. 以下の情報を入力：
   - **タイトル**: Issue の簡潔な説明
   - **説明**: 詳細な内容
   - **担当者**: 責任者の指定
   - **優先度**: High/Medium/Low
   - **開始日・終了日**: スケジュール設定
   - **進捗率**: 0-100%で設定

### Issueのステータス管理

| ステータス | 説明 | 自動遷移条件 |
|-----------|------|------------|
| **Todo** | 未着手 | 新規作成時のデフォルト |
| **In Progress** | 作業中 | 進捗率 > 0% |
| **Review** | レビュー待ち | 手動設定 |
| **Done** | 完了 | 進捗率 = 100% |

### Issue編集・更新

- **インライン編集**: 一覧画面で直接編集可能
- **詳細編集**: 詳細ページで全項目編集
- **バルク操作**: 複数Issueの一括更新

---

## WBS（作業分解構造）

### WBSツリーの構築

1. WBSページにアクセス
2. 親タスクを作成
3. ドラッグ&ドロップで子タスクを追加
4. 階層構造を整理

### WBSの操作

- **展開/折りたたみ**: ツリーの表示制御
- **並び替え**: ドラッグ&ドロップでの順序変更
- **階層変更**: インデント・アウトデントでレベル調整

### WBSのベストプラクティス

- **適切な粒度**: 1つのタスクは1-5日程度の作業量
- **明確な成果物**: 各タスクの完了条件を明確化
- **担当者の明確化**: 全てのタスクに責任者を指定

---

## ガントチャート

### ガントチャートの表示

1. プロジェクトビューにアクセス
2. 左側にWBSツリー、右側にガントチャートが表示
3. タイムラインは日/週/月単位で切り替え可能

### ガントチャートの操作

#### タスクバー操作
- **ドラッグ移動**: タスクの開始日変更
- **端点ドラッグ**: 期間の調整
- **進捗表示**: バー内の色で進捗状況を表示

#### 依存関係
- **矢印線**: タスク間の依存関係を視覚表示
- **依存関係の種類**:
  - Finish-to-Start (FS): 前のタスク完了後に開始
  - Start-to-Start (SS): 同時開始
  - Finish-to-Finish (FF): 同時完了
  - Start-to-Finish (SF): 前のタスク開始後に完了

#### クリティカルパス
- **赤色表示**: プロジェクトの最短完了日に影響するタスク
- **自動計算**: 依存関係と期間から自動算出

### ガントチャートのカスタマイズ

- **表示期間**: 日/週/月/四半期での表示切り替え
- **色分け**: ステータス別、担当者別での色分け
- **フィルタリング**: 特定条件でのタスク絞り込み

---

## API利用

### API文書

Swagger UIでAPIの詳細仕様を確認できます：
```
http://localhost:3001/api/docs
```

### 主要APIエンドポイント

#### プロジェクト管理
```bash
# プロジェクト一覧取得
GET /api/v1/projects

# プロジェクト作成
POST /api/v1/projects
```

#### Issue管理
```bash
# Issue一覧取得
GET /api/v1/projects/{projectId}/issues

# Issue作成
POST /api/v1/projects/{projectId}/issues

# Issue更新
PUT /api/v1/issues/{issueId}
```

#### ガントデータ
```bash
# ガントチャートデータ取得
GET /api/v1/projects/{projectId}/gantt

# WBSデータ取得
GET /api/v1/projects/{projectId}/wbs
```

### 認証

APIアクセスには認証が必要です：

```bash
# ログイン
POST /api/v1/auth/login
{
  "email": "admin@example.com",
  "password": "admin123"
}

# JWTトークンを取得し、以降のリクエストのHeaderに含める
Authorization: Bearer <jwt_token>
```

---

## トラブルシューティング

### よくある問題と解決方法

#### 1. ページが表示されない
**症状**: `http://localhost:3000` にアクセスできない

**解決方法**:
```bash
# コンテナ状態確認
docker ps

# Webサービス再起動
docker compose -f docker-compose.dev.yml restart web

# ログ確認
docker logs gantt-web-dev --tail 50
```

#### 2. APIが応答しない
**症状**: API呼び出しでエラーが発生

**解決方法**:
```bash
# API健全性チェック
curl http://localhost:3001/health

# APIサービス再起動
docker compose -f docker-compose.dev.yml restart api

# データベース接続確認
docker exec gantt-postgres-dev pg_isready -U gantt_user -d gantt_chart_dev
```

#### 3. データが保存されない
**症状**: 作成したIssueやプロジェクトが消失

**解決方法**:
```bash
# データベースコンテナ確認
docker exec gantt-postgres-dev psql -U gantt_user -d gantt_chart_dev -c "\dt"

# ボリューム確認
docker volume ls | grep postgres
```

#### 4. 依存関係が正しく表示されない
**症状**: ガントチャートで依存関係の線が表示されない

**解決方法**:
1. Issue間の依存関係が正しく設定されているか確認
2. 日付設定に矛盾がないか確認
3. プロジェクトのスケジューリング機能が有効か確認

### ログの確認方法

```bash
# Web アプリケーションログ
docker logs gantt-web-dev --tail 100 -f

# API サーバーログ
docker logs gantt-api-dev --tail 100 -f

# データベースログ
docker logs gantt-postgres-dev --tail 100 -f
```

### パフォーマンス監視

システムには組み込みのパフォーマンス監視機能があります：

```bash
# パフォーマンス統計取得
curl http://localhost:3001/api/v1/system/performance

# データベースメトリクス
curl http://localhost:3001/api/v1/system/database-metrics
```

---

## サポート情報

### システム要件
- **Docker**: 20.10以上
- **Docker Compose**: 2.0以上
- **ブラウザ**: Chrome/Firefox/Safari/Edge（最新版）
- **ポート**: 3000（Web）, 3001（API）, 5432（DB）

### 設定ファイル
- `docker-compose.dev.yml`: 開発環境設定
- `apps/api/.env`: API環境変数
- `apps/web/.env.local`: Web環境変数

### バックアップとリストア

#### データベースバックアップ
```bash
docker exec gantt-postgres-dev pg_dump -U gantt_user gantt_chart_dev > backup.sql
```

#### データベースリストア
```bash
docker exec -i gantt-postgres-dev psql -U gantt_user gantt_chart_dev < backup.sql
```

---

## お問い合わせ

技術的な問題や機能に関するご質問は、プロジェクトのIssueトラッカーまでお寄せください。

**Happy Project Management! 🚀**