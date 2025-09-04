# プロダクト仕様書（v1.0 / 完成版）

> 対象: **BacklogのようにIssueでタスク管理をしつつ、WBSやガントチャートを閲覧・作成・修正できるWebアプリケーション**
> 目的: チーム計画～実行～振り返りまでを1つのUIで完結し、計画精度と実行速度を高める

---

## 0. 用語定義

* **Issue**: 作業単位（課題/要求/バグ/タスクなど）
* **WBS**: 作業分解構成（プロジェクトを階層的に分割）
* **ガントチャート(Gantt)**: 期間・依存関係・進捗を可視化する横棒グラフ
* **親Issue/子Issue**: Backlogと同様にタスクを階層化して管理
* **マイルストーン/リリース**: 区切り日またはリリース対象
* **依存関係**: 先行/後続関係（FS/FF/SS/SF）とラグ
* **カレンダー**: 稼働日/休日/所定労働時間設定

---

## 1. ビジョン & 成功指標

* **プロダクトビジョン**: *「Issue中心の軽快さ」と「WBS/ガントの計画力」を両立し、現場が“使い続ける”計画ツールを提供する。*
* **Primary KPI**: ガント編集にかかる平均時間の短縮（操作回数・操作時間の双方で測定）
* **Secondary KPI**: 週次アクティブプロジェクト数、依存変更後の自動再計算成功率、Undo成功率、NPS

---

## 2. スコープ

### 2.1 MVP

* Issue CRUD + 担当者/ラベル/ステータス/工数
* 親子Issueの設定とWBSへの反映
* ガント: バー編集（開始/終了/進捗）、依存(FS)追加＋自動シフト
* カレンダー: 稼働日設定、個人稼働率
* 進捗: 実績登録とバー色反映
* 監査: 主要変更の履歴/Undo

### 2.2 次フェーズ

* 依存タイプ全種(FF/SS/SF) + ラグ
* ダッシュボード（PM/Dev/Executive）
* 外部連携（GitLabなど）
* 複数カレンダー・タイムゾーン対応
* RBAC強化、リアルタイム共同編集、API/Webhook

---

## 3. ステークホルダー & ペルソナ

* **優先度**: 開発者 > PM/PL > 経営層
* **開発者**: 自タスクの確認・更新・完了報告を最小操作で実施
* **PM/PL**: 計画作成・依存設計・進捗俯瞰
* **経営層**: ロードマップ確認

---

## 4. ユースケース

* 開発者: 自分のIssue確認、進捗更新、完了報告
* PM/PL: WBS作成、ガントで依存調整
* 経営層: ロードマップ確認

---

## 5. 非機能要件

* **性能**: 1,000 Issueでガント描画<1.5s、操作応答<100ms
* **可用性**: 99.9%
* **セキュリティ**: SSO、RBAC、監査ログ、暗号化
* **アクセシビリティ**: WCAG 2.1 AA
* **国際化**: 日本語/英語、TZ吸収

---

## 6. ドメインモデル

* **Project**: `project_id, name, visibility(private|password|public), password_hash?, calendar_id, settings, created_at, updated_at`
* **Issue**: id, title, description(Markdown対応), status, type, priority(1–10), estimate(h|d), spent, assignee, labels, start\_date, due\_date, progress, relations, attachments, external\_links, milestone, closed\_at, created\_by, created\_at, updated\_at
* **WBSNode**: issue\_id, parent, sort\_index
* **Dependency**: predecessor, successor, type, lag
* **Milestone**, **Calendar**, **ActivityLog** など
* **ポリシー**: 工数単位切替、進捗率集計、ステータスにBlocked、依存はFS（MVP）
* **Issue**: id, title, description, status, type, priority(1–10), estimate(h|d), spent, assignee, labels, start\_date, due\_date, progress, relations, attachments, external\_links, milestone, closed\_at, created\_by, created\_at, updated\_at
* **WBSNode**: issue\_id, parent, sort\_index
* **Dependency**: predecessor, successor, type, lag
* **Milestone**, **Calendar**, **ActivityLog** など
* **ポリシー**: 工数単位切替、進捗率集計、ステータスにBlocked、依存はFS（MVP）

---

## 7. ガントチャート操作仕様

* **ビュー**: Shift+ホイールでズーム、Ctrl/Cmd+ホイールで水平スクロール
* **編集**: バー移動=自由移動、期間変更、進捗更新（％/％+実工数切替）、依存作成/削除、インライン編集、Undo/Redo=Ctrl+Z/Y
* **制約**: 稼働日考慮、親子整合
* **表示**: 優先度グラデーションor色分けなし、Blockedはストライプ、期限超過警告
* **依存関係表示**: 折れ線、矢印あり/なし切替、色固定グレー、重なり優先＋ホバー強調、端スナップ＋ツールチップ
* **性能**: 仮想スクロール、差分描画
* **KPI計測**: drag/resize/dependency/undo等をログ

---

## 8. 通知 / 共有

* **通知チャネル**: In-App, メール, Slack
* **トリガ**: 期限接近/超過、ステータス変更、依存遅延、担当変更
* **ノイズ制御**: 配信ON/OFF、ダイジェスト（既定=毎日18:00 JST）、ミュート
* **共有**: フィルタ済みWBS/ガントを閲覧専用リンク（既定有効期限7日）、PNG/PDF/CSVエクスポート

---

## 9. 監査ログ / 履歴管理

* **対象**: Issue更新、依存追加/削除、ガント操作、権限、共有、通知
* **保持**: 90日オンライン、1年アーカイブ、チェーンハッシュ改ざん検知
* **Undo/Redo/Revert** も記録
* **API**: GET /projects/\:id/audit-logs

---

## 10. 権限モデル（RBAC）

* **ロール**: Owner / Project Admin / Member / Viewer
* **操作マトリクス**: Project設定、Issue作成/編集/削除、WBS/ガント編集、依存管理、バックアップ/復元、監査閲覧、エクスポートなど
* **原則**: Memberは自分担当のみ編集可（設定で拡張可）

---

## 11. エクスポート / バックアップ / 復元

* **Excel**: Issue.xlsx / WBS.xlsx / Gantt.xlsx
* **バックアップ**: ZIP（CSV, JSON, 設定）、週次自動バックアップ（最新4世代）
* **復元**: ドライラン検証、マッピング、競合解決（上書き/スキップ/重複）、監査ログ
* **API**: export/backup/restore

---

## 12. API仕様

* **共通**: /api/v1, Bearer認証, ETag/If-Match, Idempotency-Key
* **Issue**: CRUD, Bulk更新
* **WBS**: 取得・並び替え
* **依存関係**: FSのみ
* **ガント**: 表示用データ取得、ドライランAPI
* **カレンダー**: 取得/更新
* **共有/バックアップ**: リンク作成/失効、出力/復元
* **通知/監査ログ**: API定義

---

## 13. データモデル制約

* **Issue**: priority 1–10, progress 0–100, start<=due, 親子循環禁止
* **Dependency**: 重複/循環/自己参照禁止、FSのみ
* **WBSNode**: 1Issue=1ノード、sort\_indexユニーク
* **削除ポリシー**: Issue=論理削除、Project=アーカイブ
* **性能**: ActivityLog=時間パーティション、Issue=projectハッシュ

---

## 14. UIワイヤーフレーム

* **Issue一覧**: テーブル＋サイドパネル
* **WBS×ガント**: 左ペイン=階層、右ペイン=バー＋依存線
* **Issue詳細**: 基本情報、説明、ラベル、親子、工数、関連/添付、履歴

---

## 15. スケジューリングアルゴリズム

* **前進/後退パス**で ES/EF/LS/LF/TF を計算
* **TF==0 をクリティカル**として表示
* **親Issue**: 子の期間min/max、進捗は工数重み集計
* **増分再計算**: 影響範囲のみ再トポ
* **例外処理**: 循環、非稼働日、期限超過警告、Blocked表示
* **保存**: ComputedScheduleに保持、差分をUIでハイライト
* **状態判定**: on\_track / at\_risk / late

---

## 17. 実装決定事項（PoC前提）

### 技術・アーキ

* フロントエンド: Next.js + React 18、Zustand、React Query、react-virtualized
* ガント実装: 自作SVGベース、D3のスケール利用
* バックエンド: Node.js + NestJS
* DB: PostgreSQL 15 + Prisma

### ドメイン/データ

* ID: ULID（クライアント生成可）
* 楽観ロック: versionカラム + ETag/If-Match
* ラベル: 正規化（IssueLabelテーブル）
* 監査ログ: オンライン90日(DBパーティション) + S3アーカイブ

### スケジューリング

* カレンダー: プロジェクト独自 + 祝日CSVインポート
* 工数換算: 内部hで保持、切替時は四捨五入
* 再計算契機: Issue/依存/カレンダー/設定の確定時

### API

* ページング: cursorベース(limit=50,max=200)
* バルクAPI: デフォルト=ベストエフォート、`atomic=true`指定でTx一括
* スロットリング: 60 req/min/ユーザー

### 認証/権限

* 認証: OIDC(Auth0/WorkOS)
* 権限: サービス層集中適用 + SQL条件注入

### 通知/共有

* メール: SendGrid等
* Slack: MVPはWebhook、次でOAuth App

### ファイル/出力

* 添付: S3互換(署名URL)
* PDF/PNG: Puppeteer
* Excel: xlsx/SheetJS

### 運用/監視

* ログ/メトリクス/トレース: OpenTelemetry + Grafana stack
* 例外監視: Sentry
* テレメトリ: 仕様イベント(JSONスキーマ化)

### 性能予算

* 初回描画<1.5s、ドラッグ応答<100ms、ズーム切替<150ms
* KPI計測フックを初期実装で組み込み

### i18n/TZ

* 日付: Temporal API polyfill or date-fns-tz
* 既定TZ: プロジェクトTZ=Asia/Tokyo、ユーザー表示=ローカル

### アクセシビリティ

* キーマップを別ファイル化(Z/Y, \[ ], I)＋ヘルプモーダル

### セキュリティ

* PIIマスク、添付スキャン、Secrets=KMS管理
* DB日次スナップ＋ストレージバージョニング

### テスト/CI/CD

* テスト: ユニット(ドメイン/スケジューラ)、API契約、E2E(Playwright)
* Fixtures: サンプルプロジェクト
* CI/CD: GitHub Actions(Lint/TypeCheck/Test→Docker署名→Staging自動→本番手動)

---

## 18. PoC開発計画（最小PoC版）

### 最小PoCの範囲

**含める**

* Issue CRUD（タイトル/説明/ステータス/担当/期限）
* Issue一覧テーブル＋詳細サイドパネル
* WBS（親子Issue階層、並び替え）
* ガントチャート（バー表示、移動/伸縮、FS依存、Todayライン）
* 進捗入力（％のみ、親は子集計）
* Undo/Redo（Ctrl+Z/Y）
* カレンダー（平日固定稼働、1日=8h固定）
* 監査ログ（Issue CRUDとガント操作のみ）

**含めない**

* 通知（Slack/メール/In-App）
* 共有・エクスポート（PNG/PDF/Excel/CSV）
* バックアップ/復元
* 複数カレンダー/タイムゾーン
* RBAC細分化（Owner/Admin/Viewerのみ）
* 進捗％＋工数切替
* Blocked自動反映/クリティカルパス計算
* 国際化（i18n）
* リアルタイム共同編集

### 開発スプリント（想定3〜4週間）

* **Week 1**: 基盤構築（認証/DB/フロント枠組み）+ Issue CRUD
* **Week 2**: WBS階層表示 + ガントチャート初期表示
* **Week 3**: ガント編集（移動/伸縮/依存）、Undo/Redo
* **Week 4**: 進捗入力、監査ログ最小版、安定化（パフォーマンス計測込み）

### ゴール

* 5人規模のチームが1〜2週間利用できる最小版
* WBS＋ガントの操作感をPoC評価し、フィードバック収集

## 19. 最小PoC定義（3–4週間）

**範囲（含む）**

* Issue: CRUD（タイトル/説明/担当/ステータス/期限）、一覧（テーブル）＋詳細サイドパネル
* WBS: 親子階層表示、ドラッグ&ドロップで並び替え/階層変更
* ガント: バー表示、バー移動/伸縮（自由移動）、FS依存の追加/削除、Todayライン
* 進捗: Leafは％手入力、Parentは子集計
* Undo/Redo: `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y`
* カレンダー: 平日稼働・祝日なし、1日=8h固定
* 監査ログ: Issue作成/更新/削除、ガント操作のみ記録

**範囲（含まない）**

* 通知（Slack/メール/In‑App）、共有リンク、PNG/PDF/Excel/CSV出力
* バックアップ/復元、複数カレンダー/タイムゾーン
* RBACの細分化（Owner/Admin/Viewerの簡易のみ）
* ％＋実工数表示切替、Blocked自動反映、クリティカルパス表示
* i18n、リアルタイム共同編集

**受入基準（Definition of Done）**

1. 1,000 Issueのダミーデータで、ガント初回描画 < **1.5s**、ドラッグ応答 < **100ms**
2. WBSとガントの縦スクロールが同期し、階層変更が即時ガントに反映される
3. FS依存を追加/削除でき、先行移動で後続の開始日が自動調整される
4. Undo/Redoがバー移動・伸縮・依存作成/削除・Issue編集に対して動作する
5. 主要操作（drag/resize/dependency/undo）がテレメトリに記録される

**デモシナリオ**

* シナリオA: 5件のIssueでWBS作成→ガントで期間調整→依存設定→Undo/Redo
* シナリオB: 先行タスクを+2日、後続が+2日へ連鎖→Todayラインで進捗を％更新
* シナリオC: 親に子を2件配下へ移動→親の期間/進捗が自動ロールアップ

**リスク/前提**

* ガントはSVG自作（描画最適化必須）
* 休日/祝日ロジックはPoCでは簡略（平日判定のみ）
* 認証は簡易（OIDCログインのみ、招待/権限は最小）

---

## 20. PoC環境セットアップ手順

### 20.1 前提ツール

* Node.js 20.x / npm または pnpm
* Docker / Docker Compose v2
* GitHub アカウント（CI/CD用）

### 20.2 リポジトリ構成（例）

```
repo/
  apps/
    api/        # NestJS + Prisma
    web/        # Next.js
  packages/
    shared/     # 型・共通ユーティリティ（将来）
  infra/
    docker/
      docker-compose.yml
  prisma/       # スキーマ・マイグレーション
  scripts/      # seed/fixtures
```

### 20.3 環境変数

`apps/api/.env`

```
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@db:5432/poc?schema=public
JWT_AUDIENCE=poc
JWT_ISSUER=poc
PORT=3001
```

`apps/web/.env.local`

```
NEXT_PUBLIC_API_BASE=http://localhost:3001/api/v1
```

### 20.4 Docker Compose

`infra/docker/docker-compose.yml`

```yaml
version: "3.9"
services:
  db:
    image: postgres:15
    container_name: poc-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: poc
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL","pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 20
  api:
    build: ../../apps/api
    depends_on:
      db:
        condition: service_healthy
    env_file: ../../apps/api/.env
    ports: ["3001:3001"]
    command: ["npm","run","start:dev"]
    volumes:
      - ../../apps/api:/usr/src/app
  web:
    build: ../../apps/web
    depends_on: [api]
    env_file: ../../apps/web/.env.local
    ports: ["3000:3000"]
    command: ["npm","run","dev"]
    volumes:
      - ../../apps/web:/usr/src/app
volumes:
  pgdata:
```

### 20.5 Prisma 初期化

`prisma/schema.prisma`（抜粋）

```prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }
model Project { id String @id @default(uuid()) name String createdAt DateTime @default(now()) issues Issue[] }
model Issue {
  id String @id @default(uuid())
  projectId String
  parentIssueId String?
  title String
  description String @default("")
  status String // todo|doing|blocked|review|done
  type   String // feature|bug|spike|chore
  priority Int  // 1..10
  estimateValue Int
  estimateUnit  String // h|d
  spent Int @default(0)
  assigneeId String?
  startDate DateTime?
  dueDate   DateTime?
  progress  Int @default(0)
  labels    String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([projectId, parentIssueId])
}
model Dependency {
  id String @id @default(uuid())
  projectId String
  predecessorId String
  successorId String
  type String // FS (MVP)
  lag  Int    @default(0)
  createdAt DateTime @default(now())
  @@index([projectId, predecessorId])
  @@index([projectId, successorId])
  @@unique([projectId, predecessorId, successorId, type])
}
```

初回セットアップ：

```bash
cd apps/api
npm i
npx prisma generate
npx prisma migrate dev --name init
```

### 20.6 ダミーデータ投入（1,000 Issue）

`scripts/seed.ts`

```ts
/*
  Seed script for PoC
  - Project 1件
  - Users 5件（ダミー）
  - Issues ~1,000件（WBS: 深さ3/幅5 ≒ 155件 + フラットで埋め）
  - Dependencies: FS をランダム（DAG保証）
  - カレンダー: 平日稼働（祝日考慮なし）
*/
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

// ===== Utility =====
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T>(arr: T[]) => arr[rand(0, arr.length - 1)]

function isWorkday(d: Date) {
  const day = d.getDay();
  return day !== 0 && day !== 6; // Mon-Fri
}
function addWorkdays(base: Date, n: number) {
  const d = new Date(base)
  const step = n >= 0 ? 1 : -1
  let remain = Math.abs(n)
  while (remain > 0) {
    d.setDate(d.getDate() + step)
    if (isWorkday(d)) remain--
  }
  return d
}
function nextWorkday(d: Date) {
  const x = new Date(d)
  while (!isWorkday(x)) x.setDate(x.getDate() + 1)
  return x
}

// ===== Config =====
const TOTAL_ISSUES = 1000
const TREE_DEPTH = 3
const BRANCHING = 5
const USERS = [
  { id: randomUUID(), name: '佐藤' },
  { id: randomUUID(), name: '鈴木' },
  { id: randomUUID(), name: '田中' },
  { id: randomUUID(), name: '高橋' },
  { id: randomUUID(), name: '伊藤' },
]
const LABELS = ['frontend','backend','infra','bug','feature','urgent','lowrisk']
const TYPES = ['feature','bug','spike','chore']
const STATUSES = ['todo','doing','blocked','review','done']

// ===== Main =====
async function main() {
  console.time('seed')
  // Clean (dev only)
  await prisma.$transaction([
    prisma.dependency.deleteMany({}),
    prisma.issue.deleteMany({}),
    prisma.project.deleteMany({}),
  ])

  const project = await prisma.project.create({ data: { name: 'PoC Project' } })

  // Create hierarchical issues first (depth 3, branching 5)
  const created: { id: string; isLeaf: boolean }[] = []

  let counter = 1
  async function createIssue(parentId: string | null, depth: number): Promise<string> {
    const title = parentId ? `Issue ${counter} (d${depth})` : `Root Epic`
    counter++
    const today = new Date()
    const start = nextWorkday(addWorkdays(today, rand(0, 20)))
    const durationDays = rand(1, 10)
    const due = addWorkdays(start, durationDays - 1)
    const status = pick(STATUSES)
    const done = status === 'done'
    const progress = done ? 100 : rand(0, 90)

    const issue = await prisma.issue.create({
      data: {
        projectId: project.id,
        parentIssueId: parentId,
        title,
        description: 'Auto seeded',
        status,
        type: pick(TYPES),
        priority: rand(1, 10),
        estimateValue: rand(4, 40), // hours
        estimateUnit: 'h',
        spent: rand(0, 20),
        assigneeId: pick(USERS).id,
        startDate: start,
        dueDate: due,
        progress,
        labels: Array.from(new Set([pick(LABELS), pick(LABELS)])).slice(0, rand(0,2)),
      },
      select: { id: true },
    })

    const isLeaf = depth === TREE_DEPTH
    created.push({ id: issue.id, isLeaf })

    if (!isLeaf) {
      for (let i = 0; i < BRANCHING; i++) {
        await createIssue(issue.id, depth + 1)
      }
    }
    return issue.id
  }

  // Root → depth 3 tree (~1 + 5 + 25 + 125 = 156)
  await createIssue(null, 0)

  // Fill the rest as flat tasks under root (parent=null) to reach TOTAL_ISSUES
  const toCreateFlat = Math.max(0, TOTAL_ISSUES - created.length)
  const today = new Date()
  const flatBatch = Array.from({ length: toCreateFlat }).map((_, i) => {
    const start = nextWorkday(addWorkdays(today, rand(0, 20)))
    const durationDays = rand(1, 10)
    const due = addWorkdays(start, durationDays - 1)
    const status = pick(STATUSES)
    const done = status === 'done'
    return {
      id: randomUUID(),
      projectId: project.id,
      parentIssueId: null as string | null,
      title: `Flat Issue ${i + 1}`,
      description: 'Auto seeded (flat)',
      status,
      type: pick(TYPES),
      priority: rand(1, 10),
      estimateValue: rand(4, 40),
      estimateUnit: 'h',
      spent: rand(0, 20),
      assigneeId: pick(USERS).id,
      startDate: start,
      dueDate: due,
      progress: done ? 100 : rand(0, 90),
      labels: Array.from(new Set([pick(LABELS), pick(LABELS)])).slice(0, rand(0,2)),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  })

  // Bulk insert flats in chunks
  const CHUNK = 200
  for (let i = 0; i < flatBatch.length; i += CHUNK) {
    await prisma.issue.createMany({ data: flatBatch.slice(i, i + CHUNK) })
  }

  // Collect all issues for dependency creation (only leaves + some flats)
  const allIssues = await prisma.issue.findMany({
    where: { projectId: project.id },
    select: { id: true, parentIssueId: true },
    orderBy: { createdAt: 'asc' },
  })
  const idIndex = new Map(allIssues.map((it, idx) => [it.id, idx]))

  // Make DAG edges: successor index > predecessor index to avoid cycles
  const deps: { projectId: string; predecessorId: string; successorId: string; type: string; lag: number }[] = []
  const maxEdges = Math.floor(allIssues.length * 0.8) // density control
  for (let i = 1; i < allIssues.length && deps.length < maxEdges; i++) {
    // each node may depend on 0..2 previous nodes
    const num = rand(0, 2)
    for (let k = 0; k < num; k++) {
      const j = rand(0, i - 1)
      if (j === i) continue
      const a = allIssues[j].id
      const b = allIssues[i].id
      // avoid parent-child direct dependency to keep it simple
      const parentChild = allIssues[i].parentIssueId === a || allIssues[j].parentIssueId === b
      if (parentChild) continue
      deps.push({ projectId: project.id, predecessorId: a, successorId: b, type: 'FS', lag: 0 })
    }
  }

  // Insert dependencies in chunks, ignoring duplicates by unique constraint
  for (let i = 0; i < deps.length; i += CHUNK) {
    await prisma.dependency.createMany({ data: deps.slice(i, i + CHUNK), skipDuplicates: true })
  }

  console.log(`Project: ${project.id}`)
  const counts = await Promise.all([
    prisma.issue.count({ where: { projectId: project.id } }),
    prisma.dependency.count({ where: { projectId: project.id } }),
  ])
  console.log(`Issues: ${counts[0]}, Dependencies: ${counts[1]}`)
  console.timeEnd('seed')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
```

実行：

```bash
npm run seed
```

### 20.7 起動手順

```bash
cd infra/docker
docker compose up --build
# Web: http://localhost:3000  API: http://localhost:3001/api/v1
```

### 20.8 APIの基本スクリプト（NestJS）

`apps/api/package.json`（抜粋）

```json
{
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "seed": "ts-node -r ts-node/register scripts/seed.ts"
  }
}
```

### 20.9 CI/CD（最小）

`.github/workflows/ci.yml`

```yaml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci --workspaces
      - run: npm run -w apps/api prisma:generate
      - run: npm test --workspaces
```

### 20.10 動作確認チェック

* /health エンドポイントが 200 を返す
* Issue CRUD が動作し、WBSツリーに反映される
* ガントのバー移動/伸縮で API に PATCH が飛ぶ（ActivityLog 記録）
* 1,000 Issue で初回描画 < 1.5s（KPIログを確認）

---

## 21. APIエンドポイント雛形（MVP/PoC用）

### 21.1 共通

* Base Path: `/api/v1`
* 認証: Bearer JWT (OIDC)
* レスポンス: JSON, `Content-Type: application/json; charset=utf-8`
* ページング: `limit` (既定50, max200), `cursor`
* エラー形式:

```json
{ "error": { "code": "validation_error", "message": "field invalid", "fields": { "title": "required" } } }
```

### 21.2 Health / Meta

* `GET /health` → 200 OK
* `GET /version` → { api: "1.0.0", commit: "..." }

### 21.3 Project

* `GET /projects` → プロジェクト一覧
* `POST /projects` { name } → 新規作成
* `GET /projects/:id`
* `PATCH /projects/:id`
* `DELETE /projects/:id` （論理削除）

### 21.4 Issue

* `GET /projects/:projectId/issues` → フィルタ: assigneeId, status, label, priority, start\_gte, due\_lte, search
* `POST /projects/:projectId/issues` { title, status, assigneeId?, priority?, startDate?, dueDate? }
* `GET /issues/:id`
* `PATCH /issues/:id`
* `DELETE /issues/:id`
* `PATCH /projects/:projectId/issues/bulk` → { operations: \[ { op, id, fields… } ] }

### 21.5 WBS

* `GET /projects/:projectId/wbs` → ツリー構造返却
* `PATCH /projects/:projectId/wbs/reorder` { moves: \[ { id, parentIssueId, sortIndex } ] }

### 21.6 Dependency

* `GET /projects/:projectId/dependencies`
* `POST /projects/:projectId/dependencies` { predecessorId, successorId, type: "FS", lag: 0 }
* `DELETE /dependencies/:id`

### 21.7 Gantt

* `GET /projects/:projectId/gantt?from&to&zoom=day|week|month`

  * 戻り値: issues (id, title, startDate, dueDate, progress, assignee), dependencies\[]
* `POST /projects/:projectId/schedule/preview` { operations\[] } → ドライラン結果

### 21.8 Calendar

* `GET /projects/:projectId/calendar`
* `PUT /projects/:projectId/calendar` { workingDays: \[1,2,3,4,5], holidays: \["2025-09-15"], dailyHours: 8 }

### 21.9 ActivityLog

* `GET /projects/:projectId/audit-logs?from&to&actor&entityType&action`

### 21.10 User（簡易）

* `GET /users/me`
* `GET /projects/:projectId/members`
* `POST /projects/:projectId/members` { userId, role }
* `DELETE /projects/:projectId/members/:userId`

---

## 21. APIエンドポイント定義（雛形 / OpenAPI 3.1）

> PoC用の最小スケルトン。実装時は `components.schemas` を拡張し、`securitySchemes` とレスポンス例を充実させる。

```yaml
openapi: 3.1.0
info:
  title: WBS/Gantt API
  version: 0.1.0
servers:
  - url: /api/v1
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  parameters:
    CursorParam:
      in: query
      name: cursor
      schema: { type: string }
    LimitParam:
      in: query
      name: limit
      schema: { type: integer, default: 50, maximum: 200 }
  schemas:
    Issue:
      type: object
      properties:
        id: { type: string }
        projectId: { type: string }
        parentIssueId: { type: ["string","null"] }
        title: { type: string, maxLength: 256 }
        description: { type: string }
        status: { enum: [todo, doing, blocked, review, done] }
        type: { enum: [feature, bug, spike, chore] }
        priority: { type: integer, minimum: 1, maximum: 10 }
        estimateValue: { type: integer }
        estimateUnit: { enum: [h, d] }
        spent: { type: integer }
        assigneeId: { type: ["string","null"] }
        startDate: { type: ["string","null"], format: date }
        dueDate:   { type: ["string","null"], format: date }
        progress:  { type: integer, minimum: 0, maximum: 100 }
        labels: { type: array, items: { type: string } }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    IssueCreate:
      allOf:
        - $ref: '#/components/schemas/Issue'
      required: [projectId, title, status, priority]
    IssueUpdate:
      type: object
      description: Partial update (If-Match required)
      additionalProperties: true
    Dependency:
      type: object
      properties:
        id: { type: string }
        projectId: { type: string }
        predecessorId: { type: string }
        successorId: { type: string }
        type: { enum: [FS] }
        lag: { type: integer }
    GanttBar:
      type: object
      properties:
        issueId: { type: string }
        computedStart: { type: string, format: date }
        computedEnd: { type: string, format: date }
        isParent: { type: boolean }
        progress: { type: integer }
        critical: { type: boolean }
security:
  - bearerAuth: []
paths:
  /health:
    get:
      summary: Health check
      responses: { '200': { description: OK } }

  /projects/{projectId}/issues:
    get:
      summary: List issues
      parameters:
        - name: projectId; in: path; required: true; schema: { type: string }
        - name: assigneeId; in: query; schema: { type: string }
        - name: status; in: query; schema: { enum: [todo, doing, blocked, review, done] }
        - name: label; in: query; schema: { type: string }
        - name: priorityGte; in: query; schema: { type: integer }
        - name: priorityLte; in: query; schema: { type: integer }
        - name: search; in: query; schema: { type: string }
        - $ref: '#/components/parameters/CursorParam'
        - $ref: '#/components/parameters/LimitParam'
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  items: { type: array, items: { $ref: '#/components/schemas/Issue' } }
                  nextCursor: { type: ["string","null"] }
    post:
      summary: Create issue
      requestBody:
        required: true
        content:
          application/json: { schema: { $ref: '#/components/schemas/IssueCreate' } }
      responses: { '201': { description: Created } }

  /issues/{id}:
    get:
      summary: Get issue
      parameters: [ { name: id, in: path, required: true, schema: { type: string } } ]
      responses: { '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/Issue' } } } } }
    patch:
      summary: Update issue (If-Match required)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
        - { name: If-Match, in: header, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json: { schema: { $ref: '#/components/schemas/IssueUpdate' } }
      responses: { '200': { description: OK } }
    delete:
      summary: Soft delete issue
      parameters: [ { name: id, in: path, required: true, schema: { type: string } } ]
      responses: { '204': { description: No Content } }

  /projects/{projectId}/wbs:
    get:
      summary: Get WBS outline (Issue hierarchy)
      parameters: [ { name: projectId, in: path, required: true, schema: { type: string } } ]
      responses: { '200': { description: OK } }

  /projects/{projectId}/wbs/reorder:
    patch:
      summary: Reorder / reparent issues in WBS
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                moves:
                  type: array
                  items:
                    type: object
                    properties:
                      id: { type: string }
                      parentIssueId: { type: ["string","null"] }
                      sortIndex: { type: integer }
      responses: { '200': { description: OK } }

  /projects/{projectId}/dependencies:
    get:
      summary: List dependencies
      parameters: [ { name: projectId, in: path, required: true, schema: { type: string } } ]
      responses: { '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Dependency' } } } } } }
    post:
      summary: Create dependency (FS)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [predecessorId, successorId, type]
              properties:
                predecessorId: { type: string }
                successorId: { type: string }
                type: { enum: [FS] }
                lag: { type: integer, default: 0 }
      responses: { '201': { description: Created } }

  /dependencies/{id}:
    delete:
      summary: Delete dependency
      parameters: [ { name: id, in: path, required: true, schema: { type: string } } ]
      responses: { '204': { description: No Content } }

  /projects/{projectId}/gantt:
    get:
      summary: Get bars & links for Gantt view
      parameters:
        - { name: projectId, in: path, required: true, schema: { type: string } }
        - { name: from, in: query, schema: { type: string, format: date } }
        - { name: to, in: query, schema: { type: string, format: date } }
        - { name: zoom, in: query, schema: { enum: [day, week, month, quarter] } }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  bars: { type: array, items: { $ref: '#/components/schemas/GanttBar' } }
                  dependencies: { type: array, items: { $ref: '#/components/schemas/Dependency' } }

  /projects/{projectId}/schedule/preview:
    post:
      summary: Dry-run schedule changes (no persist)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                operations:
                  type: array
                  items:
                    type: object
                    properties:
                      op: { enum: [move_dates, set_progress, reparent, resize] }
                      id: { type: string }
                      startDate: { type: ["string","null"], format: date }
                      dueDate:   { type: ["string","null"], format: date }
                      progress:  { type: ["integer","null"] }
      responses: { '200': { description: OK } }

  /projects/{projectId}/activity-logs:
    get:
      summary: List audit logs
      parameters:
        - { name: projectId, in: path, required: true, schema: { type: string } }
        - { name: from, in: query, schema: { type: string, format: date-time } }
        - { name: to, in: query, schema: { type: string, format: date-time } }
        - { name: actor, in: query, schema: { type: string } }
        - $ref: '#/components/parameters/CursorParam'
        - $ref: '#/components/parameters/LimitParam'
      responses: { '200': { description: OK } }
```

> 実装メモ：NestJS では `@nestjs/swagger` を使い、この雛形をソース注釈から自動生成することを推奨。`If-Match` 必須のPATCH、`Idempotency-Key`対応のPOSTについてはインターセプタで実装を統一する。

## 22. 運用ポリシー＆実装規約

### API/バックエンド

* バージョニング: `/api/v1` 固定、破壊変更は v2 で。
* エラーモデル: `{ error: { code, message, fields? } }`、エラーコード表を共通化。
* Idempotency: POST は `Idempotency-Key` を任意対応（将来必須化）。
* 競合処理: `ETag + If-Match` 衝突時は 409。レスポンスに最新ETagと差分概要。
* ページング: カーソル方式（limit=50, max=200）、安定ソートは `updatedAt desc, id`。
* レート制限: 60 req/min/ユーザー + 600 req/min/IP。レスポンスヘッダに `X-RateLimit-*`。
* セキュリティヘッダ: CSP, X-Content-Type-Options, Referrer-Policy, HSTS（本番のみ）。
* 添付アップロード: 最大25MB/ファイル、許可拡張子(pdf,png,jpg,xlsx,csv,txt,md)。ウイルススキャンはMMP。
* ログ形式: JSON構造化（level, ts, reqId, userId, route, latency\_ms）。PIIはマスク。

### データ/DB

* 命名規則: テーブル/カラムは snake\_case。
* マイグレーション: `prisma migrate` をPRに含める。ダウンは原則不要。
* タイムゾーン: DB=UTC固定。API入出力は date / date-time を厳密に区別。
* インデックス: (project\_id, updated\_at desc), (project\_id, due\_date), (assignee\_id, status)。
* 削除ポリシー: Issue=論理削除(deleted\_at)、Project=アーカイブ。
* ファイル保管: S3互換、署名URL有効期限=15分。

### スケジューリング/ガント

* 丸め規則: h⇄d切替は四捨五入、内部は h 保持。
* 非稼働日: 結果が非稼働なら最近接稼働日に繰延/繰上。
* Undo/Redo: UIは100ステップ保持、サーバーは直近10操作をActivityLogから復元（PoCはUIのみ）。

### フロントエンド/UX

* 楽観更新: フィールド更新/バー移動は楽観更新、409で巻き戻し＋差分提示。
* ローディング: テーブル/ガントはスケルトン表示、初回<1.5s必達。
* デザイントークン: 色・間隔・影・角丸を tokens.ts で管理。ダークモードは次期。
* キーボードヘルプ: `?`でショートカット一覧。
* ブラウザ対応: Chromium最新版/Firefox最新版/Safari最新版。

### セキュリティ/運用

* Secrets: ローカルは .env、クラウドはKMSで注入。
* 監視SLO: APIエラーレート <1%、p95<250ms、ガント初回描画<1.5s。
* アラート: p95>250msが5分継続でWarn、15分でCritical。
* プライバシー: ActivityLogはIP/UA保存、メール/氏名はマスク。
* バックアップ: DB日次スナップ（保持7日）、オブジェクトストレージはバージョニングON。

### QA/テスト

* DoD: E2E(Playwright)3本（Issue更新／WBS並べ替え／ガント移動＋依存）。
* パフォーマンス: 1,000 Issueで60fpsスクロール、ドラッグ<100msを自動計測。
* アクセシビリティ: キーボード操作通過、主要画面は色コントラスト4.5:1以上。

---

## 23. 開発フロー＆コード規約

### ブランチ戦略

* メインブランチ: `main`（常にデプロイ可能状態）
* 開発ブランチ: `develop`（任意、PoCでは省略可）
* 機能ブランチ: `feature/<topic>`
* 修正ブランチ: `fix/<topic>`
* リリースブランチ: `release/x.y`
* タグ: `vX.Y.Z`（SemVer）

### PRルール

* PR単位は **小さく保つ（\~400行以内推奨）**
* PRテンプレート: 背景 / 変更内容 / 動作確認 / 関連Issue / スクショ
* CI必須チェック: Lint / TypeCheck / UnitTest / E2E一部
* レビュー: 最低1名必須（Owner/Admin）。PoC期間はペアレビュー推奨。
* マージ方法: `squash merge` で履歴を整理

### コード規約

* 言語: TypeScript（strict）、ES2022
* Linter: ESLint + Prettier（共通設定）
* import順序: external → internal → local
* 命名規則:

  * 変数/関数: camelCase
  * 型/クラス: PascalCase
  * 定数: UPPER\_SNAKE\_CASE
  * ファイル: kebab-case
* コメント: JSDoc形式（型・関数説明）、複雑ロジックは図/擬似コードをコメント
* フロント: React Functional Components + Hooks。状態はZustand/React Query。
* バックエンド: NestJS Modules/Services/Controllersの3層。PrismaをRepository層に相当。
* DBマイグレーション: 必ず `prisma migrate` をPRに含める

### テスト規約

* ユニット: Jest（ドメイン/サービス層）、カバレッジ80%以上（PoC除外可）
* API契約: Pact/Swagger Mockを用いたContract Test
* E2E: Playwright。主要シナリオ3本必須（Issue更新/WBS並べ替え/ガント操作）
* Snapshot TestはUIのみに限定

### CI/CD規約

* CI: GitHub Actions → Lint/TypeCheck/Test
* CD: Stagingは自動、本番は手動承認
* Dockerイメージ: mainにマージ時に署名付きでPush
* バージョニング: Semantic Release（changelog自動生成）

### ドキュメント

* ADR(Architecture Decision Record) を `/docs/adr/` にMarkdownで保存
* 主要仕様変更はPRにADRを含めること

---

## 23. 開発フロー / コード規約

### 23.1 ブランチ運用

* 方式: **Trunk-Based**（`main` 安定／`dev` 統合）
* 作業ブランチ: `feat/<scope>-<short-title>` / `fix/<scope>` / `chore/<scope>`
* リリース: `release/x.y.z` を作成 → 本番デプロイ後にタグ付け
* 期限がタイトなときは **Feature Flag**（環境変数 or DB）で段階ロールアウト

### 23.2 PR ルール

* 1PRの目安: **〜400行**（テスト含まず）
* 必須: テスト/型チェック/リンタ通過、スクリーンショット or GIF（UI変更時）
* レビューア: **最低1名**（仕様影響が大きい場合は2名）
* PRテンプレ（抜粋）:

  * 目的／背景
  * 変更点（API/スキーマ/マイグレーション有無）
  * 動作確認（手順・結果）
  * 影響範囲（互換性/パフォーマンス/セキュリティ）
  * スクショ/GIF（UI）

### 23.3 コミット規約（Conventional Commits）

* `feat: ...` 新機能、`fix: ...` バグ修正、`docs: ...` ドキュメント、`chore: ...` その他
* BREAKING CHANGE はフッタに `BREAKING CHANGE: ...`
* 例: `feat(gantt): add FS link creation via drag handle`

### 23.4 コード規約

* 言語/ツール: TypeScript strict / ESLint / Prettier / EditorConfig
* 命名: 変数・関数は lowerCamel、型/クラスは UpperCamel、定数は UPPER\_SNAKE
* 例外処理: 例外は**握り潰さない**。APIは `ProblemDetails` 形式へ変換
* ロギング: ユーザー入力をそのままログしない（PIIマスク）
* UI: アクセシビリティ属性（`aria-*`）とキーボードフォーカスを必須

### 23.5 Lint/Hook

* pre-commit: `lint --fix`、`type-check`、`test -i`（変更差分のみ）
* pre-push: 全ワークスペースの `test`
* 失敗時は push 禁止（Husky or Lefthook）

### 23.6 Issue/タスク運用

* Issue テンプレ: **背景/目的、完了条件(AC)、スクショ、テスト観点、影響範囲**
* ラベル: `type:feature|bug|chore`, `area:gantt|wbs|api`, `prio:P1..P3`
* 見積: `estimate(h)`、進捗: `progress(%)` を更新
* 受け入れ基準: DoDに合致＋E2Eが緑

### 23.7 マイグレーション/リリース

* マイグレーションは**後方互換**を基本（2段階デプロイ：追加→コード→削除）
* DB 変更があるPRは **`/docs/migrations/<id>.md`** に手順を記録
* バージョニング: **SemVer**（`MAJOR.MINOR.PATCH`）
* タグ: `vX.Y.Z`。CHANGELOG を `Keep a Changelog` 形式で更新

### 23.8 環境/デプロイ

* 環境: **dev / staging / prod**
* デプロイ: GitHub Actions → コンテナレジストリ → 環境（staging自動 / prod手動承認）
* ロールバック: **直前タグ**へ即時復帰（DBはマイグレーションの後方互換性で対応）

### 23.9 品質ゲート

* 覆い率目安: **ユニット 70% / API契約 80% / クリティカルパス 90%**
* パフォーマンス: KPI（初回1.5s/ドラッグ<100ms/ズーム<150ms）をCIで計測し閾値超でFail
* セキュリティ: 依存脆弱性（High以上）でFail、Secret検出でFail

---

## 24. プロジェクト管理機能

### 24.1 Project作成/管理

* ProjectエンティティをAPI/DBに保持（既に仕様に存在）。
* **作成**: プロジェクト名、説明、開始日/終了日、稼働カレンダー、オーナーを指定。
* **更新**: 名称、説明、日付、カレンダー設定、パスワード（任意）を変更可能。
* **削除/アーカイブ**: 論理削除。アーカイブ状態では閲覧のみ可能。

### 24.2 Projectアクセス制御

* プロジェクトごとに**パスワード**を設定可能。

  * フィールド: `project.password_hash`（BCrypt等で保存）。
  * 設定/変更はOwnerのみ可能。
  * 入室時、ユーザーは**パスワード入力**が必須。
  * JWTセッションに「このプロジェクトへのアクセス権あり」を保持。
* アクセス方法:

  * `/projects/{id}/join` にパスワードPOST。
  * 成功時: セッションに`projectAccess[id]=true`を付与。
  * 失敗時: 401 Unauthorized。

### 24.3 Project API例

```yaml
/projects:
  post:
    summary: Create project
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [name]
            properties:
              name: { type: string }
              description: { type: string }
              startDate: { type: string, format: date }
              endDate: { type: string, format: date }
              password: { type: string, format: password }
    responses:
      '201': { description: Created }
/projects/{id}/join:
  post:
    summary: Join project with password
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [password]
            properties:
              password: { type: string, format: password }
    responses:
      '200': { description: OK, headers: { Set-Cookie: { description: Session updated } } }
      '401': { description: Unauthorized }
```

### 24.4 UI要件

* プロジェクト選択画面に「新規作成」ボタン。
* 一覧には**ロックアイコン**表示（パスワード付プロジェクト）。
* 初回入室時にパスワード入力モーダルを表示、以後はセッションに記録。
* プロジェクト設定画面で「パスワード設定/変更/解除」を可能に。

### 24.5 注意事項

* プロジェクトパスワードは**閲覧専用アクセスの簡易制御**であり、RBACとは別レイヤー。
* 強制公開用に「パスワードなしプロジェクト」も許可。
* 将来的に「招待リンク/ユーザーごとの権限」へ拡張可能。

---

## 24. プロジェクト管理（作成/可視性/閲覧パスワード）

**目的**: 複数プロジェクトを作成・切替でき、プロジェクト単位で閲覧可視性（private/password/public）を制御する。

### 24.1 データモデル拡張

* `Project(project_id, name, visibility: 'private'|'password'|'public', password_hash?, calendar_id, settings, created_at, updated_at)`
* 既存各エンティティは `project_id` でスコープ（Issue/WBS/Dependency/Milestone/Calendar/ActivityLog）

### 24.2 API（追加）

* `POST /projects` — 作成 `{ name, visibility, password? }`
* `GET /projects` — 一覧（ユーザーの所属 + 公開/パスワード可）
* `GET /projects/:id` — 詳細（権限または有効な project\_access\_token が必要）
* `PUT /projects/:id` — 名称/設定/visibility 更新
* `PUT /projects/:id/password` — パスワード設定/更新（Argon2idでハッシュ保存）
* `POST /projects/:id/access` — パスワード検証→ `project_access_token`(JWT, scope=projectId, role=Viewer, exp=24h) を発行

### 24.3 権限/可視性

* `visibility=private` : 招待ユーザーのみアクセス
* `visibility=password` : パスワード入力で\*\*閲覧専用(Viewer)\*\*を付与（編集不可）
* `visibility=public` : 認証不要で閲覧（**既定は無効**、MMPで有効化予定）

### 24.4 UI/UX

* ヘッダー左の**プロジェクト選択**に「+ 新規作成」
* `visibility=password` のプロジェクト選択時：**パスワードモーダル**→成功で 24h 有効の閲覧トークンを保存
* プロジェクト設定画面に**可視性**と**パスワード設定**（再入力必須/強度メータ）を追加

### 24.5 セキュリティ/運用

* パスワードは **Argon2id** でハッシュ化（メモリ 16–64MB、time cost は環境で調整）
* 試行制限：IP+ブラウザ指紋で **5回/15分** → `429` + `Retry-After`
* 成功/失敗は `ActivityLog` に記録（actorを `anonymous` or `viewer` として記録）

### 24.6 監査/テレメトリ

* `project.access.requested` / `project.access.succeeded` / `project.access.rate_limited`

### 24.7 PoCへの反映

* **Sprint 1** に「プロジェクト作成」と「可視性=private/password」を追加
* **Sprint 3** に「パスワード閲覧モード（access token発行）」を実装
* 既存仕様のRBAC/API/UIワイヤーフレームは本節の定義を優先とする

## 25. Markdown対応仕様（Issue説明）

**目的**: Issueの説明フィールドにMarkdown記法を採用し、編集とプレビューを安全に提供する。

### 25.1 データモデル

* `Issue.description_md` : Markdown原文を保存（既存の `description` を置き換え）
* `Issue.description_html` : サニタイズ済みHTMLを**キャッシュ**（読み取り専用）。`description_md` 更新時に再生成。

### 25.2 レンダリング

* 対応: **GFM**（テーブル、チェックボックス、task list）、見出し、リンク、画像、コードフェンス、インラインコード、引用。
* サニタイズ: allowlist方式。`script/style/iframe/on*`属性は除外。`target="_blank"` のリンクは `rel="noopener"` を付与。
* 画像: ドラッグ&ドロップ/ペーストで添付アップロード→本文へ自動挿入（`![](/files/...)`）。

### 25.3 UI/UX

* エディタ: **Edit / Preview** のタブ切替。ツールバー（B/I/リンク/コード/リスト/チェックボックス/表/見出し/引用/画像）。
* キーボード: Markdownショートカット（`Ctrl/Cmd+B`, `Ctrl/Cmd+I`, `Ctrl/Cmd+K`）。
* プレビュー: クライアント側レンダリング（同一サニタイズロジック）。必要に応じて `POST /render/markdown` でサーバープレビュー。

### 25.4 API

* Issue応答には `description_md` と `description_html` を含める。`description_html` は**サーバー生成のみ**。
* プレビューAPI（任意実装）: `POST /render/markdown` → `{ html }` を返却。

### 25.5 エクスポート/バックアップ

* エクスポート（Excel/CSV/JSON）は **Markdown原文** を保存。PDF/PNG出力時はレンダリング結果を使用。
* バックアップには `description_md` のみ保存（`description_html` は復元時に再生成）。

### 25.6 セキュリティ/テスト

* XSS回避テスト: 危険タグ/属性のブロック、リンク`noopener`付与をユニットテスト。
* 大量文書でも描画<50msを目標に、**差分レンダリング**（変更範囲のみ）を検討。
