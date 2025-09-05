# 実装フロー指向カスタムコマンドの使い方

> 対象：キャンバスで提供した **「実装フロー指向 — 新規 Subagents & Custom Commands」** のコマンド群
> 目的：**Explore → Plan → Spec → Scaffold → Implement → Review → Test → Perf → Docs → Release → Ops** を迷わず進める

---

## 0) 前提と配置

- 前提：Claude Code を使用（CLI/VS Code 拡張どちらでもOK）
- 配置：

  ```
  プロジェクトルート/
  ├─ .claude/
  │  ├─ agents/    ← 提供した subagent の *.md
  │  └─ commands/  ← 提供した command の *.md
  └─ CLAUDE.md     ← プロジェクト規約・レビュー観点・DoD/禁止事項
  ```

- 推奨設定（任意）：`.claude/settings.json`

  ```json
  {
    "permissions": {
      "allow": ["Bash(npm run test:*)", "Bash(pytest*)", "Bash(git diff:*)", "Read(**)", "Write(**)"],
      "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
    },
    "defaultMode": "plan"
  }
  ```

  - **最小権限**から開始し、必要に応じて `allow` を段階的に追加
  - 破壊的操作は「提案 → 承認 → 適用」を徹底（本コマンド群は **diff-first** 設計）

---

## 1) 起動と共通ルール

- 一覧確認：`/help`（説明・引数ヒントが表示）
- 実行：`/<コマンド名> [引数...]`
- すべてのコマンド本文で **対応サブエージェントを明示起動**（役割が自動で分担）
- 基本フローは **diff/patch 提示 → あなたが承認 → 適用**

---

## 2) クイックスタート（最短の流れ）

1. 新機能の企画 → `/kickoff "<機能タイトル>"`
2. タスク分割 → `/task-slice "<チケット/機能名>"`
3. 足場づくり → `/scaffold-module <モジュール名>`
4. 最小実装 → `/implement-ticket "<チケットID or 概要>"`
5. 差分レビュー → `/review-diff <パス or グロブ>`
6. テスト強化 → `/qa-generate-tests <パス or グロブ>`
7. ドキュメント同期 → `/doc-sync <パス or グロブ>`
8. リリース準備 → `/release-checklist <version>` → `/changelog <version>`

> バグ対応時は 4 の代わりに `/fix-from-log "<エラー要約>"`

---

## 3) コマンド一覧（何をするか／いつ使うか／例）

### A. 企画・計画・仕様

- **`/kickoff [title]`**
  企画の出発点。**planner** が短い計画化、**spec-writer** が PRD 下書き
  例：`/kickoff "ユーザーの進捗バー実装"`
- **`/spec-sync [path-or-glob]`**
  現状挙動と PRD の**ズレ検出 & 受け入れ条件更新案**
  例：`/spec-sync src/features/progress/**`

### B. 足場・実装

- **`/scaffold-module [module-name]`**
  **scaffolder** がモジュール雛形＋最小テストを非破壊で作成（必ず diff 提示）
  例：`/scaffold-module progress-bar`
- **`/task-slice [task-title]`**
  **planner** が **≤2時間** の作業単位へ分割（依存/優先度つき）
  例：`/task-slice "進捗バーの値と色ロジック"`
- **`/implement-ticket [ticket-id or summary]`**
  **implementer** が“受け入れ条件1つだけ”を満たす**最小変更**＋ロールバック案
  例：`/implement-ticket "FEAT-123: 進捗%に応じた色分岐"`
- **`/fix-from-log [error-summary]`**
  **debugger** が再現→原因→**最小修正パッチ**→**回帰テスト**
  例：`/fix-from-log "TypeError: undefined of progress.value"`

### C. レビュー・品質

- **`/review-diff [path-or-glob]`**
  **reviewer** が差分を **Severity(High/Med/Low)** 付きレビューし**最小修正案**提示
  例：`/review-diff "src/**/*.{ts,tsx}"`
- **`/qa-generate-tests [path-or-glob]`**
  **qa** がカバレッジの**不足領域**と**高価値テスト**の雛形を出す
  例：`/qa-generate-tests src/features/progress/**`
- **`/stabilize-flaky [path-or-glob]`**
  **qa** が**フレークテスト検知**と**安定化戦略**（リトライ/シード固定/待機最適化）
  例：`/stabilize-flaky tests/e2e/**`

### D. 性能・ドキュメント

- **`/perf-profile [path-or-glob]`**
  **perf-analyst** が計測→ボトルネック→**改善案と期待スピードアップ**
  例：`/perf-profile src/utils/calcProgress.ts`
- **`/doc-sync [path-or-glob]`**
  **doc-smith** が README/CLI/Doc の**自動同期案**（差分提示）
  例：`/doc-sync docs/**`

### E. リリース・運用

- **`/changelog [vX.Y.Z]`**
  **release-manager** が Git ログからリリースノート（Breaking/新機能/修正/検証/ロールバック）
  例：`/changelog v1.4.0`
- **`/release-checklist [version]`**
  リリース前の**安全チェック**（テスト/移行/ドキュメント/ロールバック）
  例：`/release-checklist v1.4.0`
- **`/triage-issues [label or query]`**
  **triage** がインシデント/Issue を**優先度・暫定回避・担当候補**で仕分け
  例：`/triage-issues "label:bug state:open"`

### F. セキュリティ・移行・コミット

- **`/security-scan [path-or-glob]`**
  **reviewer** がシークレット/インジェクション/権限など**簡易スキャン**
  例：`/security-scan src/**`
- **`/migration-plan [package-or-module]`**
  **planner** が段階的な**移行計画**と**ロールバック**
  例：`/migration-plan "react-router v6→v7"`
- **`/commit-safely-with-tests [type] [scope] [summary]`**
  テスト→差分要約→**Conventional Commit**文案→**承認後 commit**
  例：`/commit-safely-with-tests feat progress "color thresholds"`

---

## 4) よくある運用レシピ

- **新機能を小刻みに出す**
  `/kickoff` → `/task-slice` → (`/scaffold-module` →) `/implement-ticket` → `/review-diff` → `/qa-generate-tests` → `/doc-sync` → `/commit-safely-with-tests`
- **未知の仕様を埋める**
  `/kickoff` or `/spec-sync` で PRD/DoD を先に固めてから実装
- **重い不具合の一次対応**
  `/fix-from-log` → `/review-diff` → `/qa-generate-tests`（回帰防止） → `/release-checklist` → `/changelog`
- **パフォーマンス改善スプリント**
  `/perf-profile` → `/implement-ticket`（一点集中改善）→ `/review-diff` → Before/After を `/doc-sync` で反映

---

## 5) 使いこなしのポイント

- **“1受け入れ条件＝1実装”** を徹底
  大きいチケットは `/task-slice` で分割し、`/implement-ticket` を小さく回す
- **エージェント分業**で文脈を汚さない
  コマンド内で **planner/spec-writer/scaffolder/...** を明示起動して役割単位で思考切替
- **diff-first と承認ゲート**
  すべて“提案→承認→適用”。危険操作は `allow` を細かく限定（例：`Bash(git diff:*)` のみ許可）
- **定期的な `/spec-sync` & `/doc-sync`**
  仕様と実装のドリフトを最小化し、レビュー品質を安定化

---

## 6) トラブルシュート

- **コマンドが見えない**：`/help` に出ない→`*.md` の**拡張子・配置**を確認
- **権限で止まる**：`/permissions` または `settings.json` の `allow` を調整（最小から徐々に）
- **長い会話で精度低下**：適宜 `/clear`、または節目で新スレッド
- **テストが環境依存で落ちる**：`/stabilize-flaky` でフレーク対策を適用

---

## 7) すぐ試せるコマンド例（コピペOK）

```text
/kickoff "ユーザー進捗バー"
/task-slice "進捗%による色分岐"
/scaffold-module progress-bar
/implement-ticket "FEAT-123: 色分岐ロジック"
/review-diff "src/**/*.{ts,tsx}"
/qa-generate-tests src/features/progress/**
/doc-sync docs/**
/commit-safely-with-tests feat progress "color thresholds"
/release-checklist v1.4.0
/changelog v1.4.0
```

---

### バージョン

- このガイド: `how-to-use-command.md`
- 対応エージェント/コマンド: 「実装フロー指向 — 新規 Subagents & Custom Commands」
