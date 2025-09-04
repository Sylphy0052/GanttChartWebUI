# コード規約とスタイルガイド

## TypeScript設定
- strict mode 有効
- ES2022ターゲット
- 型定義は必須

## 命名規則
- 変数/関数: camelCase
- 型/クラス: PascalCase  
- 定数: UPPER_SNAKE_CASE
- ファイル: kebab-case
- データベース: snake_case

## ディレクトリ構造
- Frontend (Next.js):
  - `src/app/`: App Router
  - `src/components/`: React コンポーネント
  - `src/hooks/`: カスタムフック
  - `src/stores/`: Zustand ストア
  - `src/lib/`: ユーティリティ関数

- Backend (NestJS):
  - Modules/Services/Controllers の3層構造
  - Prismaを Repository層として使用
  - DTOでバリデーション（class-validator）

## React/Next.js規約
- Functional Components + Hooks のみ使用
- 状態管理: Zustand (グローバル), React Query (サーバー状態)
- CSS: Tailwind CSS使用
- 楽観的更新を基本とする

## API設計
- RESTful設計
- バージョニング: `/api/v1`
- 認証: Bearer JWT
- エラー形式: `{ error: { code, message, fields? } }`
- ページング: カーソルベース（limit=50, max=200）

## Git規約
- Conventional Commits形式
- PR単位は400行以内推奨
- squash merge使用