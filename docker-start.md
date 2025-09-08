# Docker環境での動作確認手順

GanttChart WebUIをDocker環境で起動・検証する手順書です。

## 前提条件

- Docker Desktop がインストールされている
- WSL2 環境（Windows）または Linux/macOS
- プロジェクトルートディレクトリにいること

## 📋 Docker環境検証手順

### 1. 基本コマンド

#### 環境の起動

```bash
./scripts/docker-dev.sh start
```

#### 環境の停止

```bash
./scripts/docker-dev.sh stop
```

#### 完全クリーンアップ（データも削除）

```bash
./scripts/docker-dev.sh clean
```

#### ログの確認

```bash
# 全サービスのログ
./scripts/docker-dev.sh logs

# 特定サービスのログ
./scripts/docker-dev.sh logs backend
./scripts/docker-dev.sh logs frontend
./scripts/docker-dev.sh logs postgres
```

#### イメージの再ビルド

```bash
./scripts/docker-dev.sh build
```

### 2. アクセス可能URL

Docker環境起動後、以下のURLでアクセス可能：

- **フロントエンド**: <http://localhost:3000>
- **バックエンドAPI**: <http://localhost:3001>
- **Nginx経由**: <http://localhost:8080>

### 3. 動作確認手順

#### 3.1 基本接続確認

1. フロントエンド接続確認

   ```bash
   curl http://localhost:3000
   ```

2. バックエンドAPI確認

   ```bash
   curl http://localhost:3001/health
   ```

#### 3.2 ネットワークエラー解消確認

1. **プロジェクト一覧ページでの確認**
   - ブラウザで `http://localhost:3000/projects` にアクセス
   - 以前の「ネットワークエラーが発生しました」が消えている
   - 「プロジェクトがありません。新規作成してください。」と表示される（正常動作）

2. **デバッグページでの接続テスト**
   - ブラウザで `http://localhost:3000/debug` にアクセス
   - 「Test API Connection」ボタンをクリック
   - 以下の成功メッセージが表示される：

     ```
     ✅ Success!
     Status: 200
     Data: []
     API_BASE_URL: http://localhost:3001
     ```

### 4. トラブルシューティング

#### 4.1 権限エラーが発生した場合

```bash
# コンテナの完全削除と再作成
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh build
./scripts/docker-dev.sh start
```

#### 4.2 データベース接続エラーの場合

```bash
# PostgreSQLコンテナの状態確認
./scripts/docker-dev.sh logs postgres

# データベースの再初期化
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh start
```

#### 4.3 フロントエンド接続エラーの場合

```bash
# フロントエンドコンテナのログ確認
./scripts/docker-dev.sh logs frontend

# ブラウザのキャッシュクリア
# Chrome: Ctrl+Shift+R または 開発者ツール → ネットワークタブ → 「キャッシュを無効にする」
```

## 🛠 開発時の使用方法

### 日常的な開発フロー

```bash
# 1. 環境起動
./scripts/docker-dev.sh start

# 2. 開発作業
# コードの変更は自動でコンテナに反映されます（ホットリロード対応）

# 3. ログ確認
./scripts/docker-dev.sh logs

# 4. 終了時
./scripts/docker-dev.sh stop
```

### デバッグ時の確認ポイント

- バックエンドAPI: `curl http://localhost:3001/health`
- フロントエンド: <http://localhost:3000/debug>
- データベース接続: `./scripts/docker-dev.sh logs postgres`

## 📝 注意事項

- 初回起動時はDockerイメージのビルドに時間がかかります
- WSL2環境では、ファイル権限の問題が発生することがあります
- データの永続化が必要な場合は、`clean` コマンドの使用に注意してください
- ポート 3000, 3001, 5432, 8080 が他のサービスで使用されていないことを確認してください

## ✅ 検証完了項目

- ✅ Docker環境での正常起動
- ✅ CORS設定の修正
- ✅ API URL設定の修正
- ✅ フロントエンド・バックエンド間の通信確立
- ✅ ネットワークエラーの解消
- ✅ デバッグページでのAPI接続テスト機能
