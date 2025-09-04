# GanttChartWebUI プロジェクト概要

## プロジェクトの目的
Issue管理とWBS/ガントチャート機能を統合したWebアプリケーション。Backlog風のタスク管理をしつつ、WBSやガントチャートの閲覧・作成・修正が可能。

## 技術スタック
- **Frontend**: Next.js 14, React 18, TypeScript, Zustand, React Query, Tailwind CSS  
- **Backend**: NestJS, Prisma ORM
- **Database**: PostgreSQL 15
- **ガント実装**: 自作SVGベース（D3.jsスケール利用）
- **開発ツール**: Turbo (monorepo管理), Docker Compose

## プロジェクト構造
- `apps/api/`: NestJS バックエンド
- `apps/web/`: Next.js フロントエンド  
- `packages/shared/`: 共通型定義（将来拡張）
- `prisma/`: Prismaスキーマ・マイグレーション
- `scripts/`: シードスクリプト（1,000件のダミーデータ生成）
- `infra/docker/`: Docker Compose設定

## 主要機能（PoC版）
- Issue管理（CRUD操作、担当者・ステータス・工数管理）
- WBS（親子階層表示、ドラッグ&ドロップでの並び替え）
- ガントチャート（バー編集、FS依存関係の追加/削除）
- 進捗管理（パーセンテージ入力、親タスクへの自動集計）
- Undo/Redo（Ctrl+Z/Ctrl+Y）
- カレンダー（平日稼働設定、1日8時間固定）
- 監査ログ（主要操作の履歴記録）

## パフォーマンス目標
- 1,000 Issueでのガント初回描画: < 1.5秒
- ドラッグ操作の応答: < 100ms
- ズーム切替: < 150ms