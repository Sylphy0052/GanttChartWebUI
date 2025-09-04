# 開発時の推奨コマンド

## セットアップ
```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Dockerで開発環境を起動
cd infra/docker
docker compose up -d

# データベースのマイグレーション
cd apps/api
npx prisma migrate dev

# シードデータ投入（1,000件のダミーデータ）
npm run seed
```

## 開発
```bash
# 開発サーバー起動（monorepo全体）
npm run dev

# ビルド
npm run build

# テスト
npm run test

# 型チェック
npm run type-check

# Lint
npm run lint
```

## Prisma関連
```bash
# スキーマからクライアント生成
cd apps/api
npx prisma generate

# マイグレーション作成
npx prisma migrate dev --name <migration_name>

# データベースのリセット
npx prisma migrate reset
```

## Docker関連
```bash
# サービス起動
cd infra/docker
docker compose up -d

# ログ確認
docker compose logs -f

# サービス停止
docker compose down

# ボリューム含めて削除
docker compose down -v
```

## アクセス先
- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- PostgreSQL: localhost:5432