# Project Overview - GanttChart WebUI

## Purpose
GanttChart WebUIは、プロジェクトの課題(Issue)管理とガントチャート表示を行うWebアプリケーションです。階層構造を持つ課題の管理、進捗追跡、依存関係の管理を主要機能とするプロジェクト管理ツールです。

## Main Features
- **プロジェクト管理**: プロジェクトの作成、編集、削除
- **課題(Issue)管理**: 階層構造を持つ課題の管理、進捗追跡
- **依存関係管理**: 課題間の依存関係設定（Finish-to-Start）
- **ガントチャート表示**: プロジェクトスケジュールの視覚化
- **コメント機能**: 課題に対するコメントの追加・編集
- **画像アップロード**: 課題に関連する画像の添付
- **バックアップ・エクスポート**: プロジェクトデータのJSON形式出力
- **リアルタイム通知**: WebSocketによるリアルタイム更新
- **権限管理**: プロジェクトレベルでの編集権限制御

## Architecture
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS v4
- **Backend**: NestJS + Prisma + PostgreSQL 15
- **Communication**: REST API + WebSocket (Socket.IO)
- **Database**: PostgreSQL with Asia/Tokyo timezone
- **Deployment**: Docker Compose setup available

## Key Design Decisions
- 論理削除対応 (is_deleted フィールド)
- 楽観的排他制御 (バージョン管理)
- タイムゾーン対応 (Asia/Tokyo)
- 階層構造のIssue管理
- Role-based access control (Viewer/Editor)

## Development Environment
- Node.js 20+
- TypeScript throughout
- Docker & Docker Compose for production deployment
- Hot reload development setup