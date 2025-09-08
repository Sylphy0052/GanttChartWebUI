# ロールバック計画 - プロジェクト共有パスワード機能

## 実装内容

### 追加されたファイル
- `/src/projects/dto/project-password-auth.dto.ts` - プロジェクト共有パスワード認証用DTO
- `/test-project-password.js` - テストファイル

### 変更されたファイル
1. `/package.json` - bcrypt, @types/bcrypt, node-fetch の依存関係追加
2. `/src/projects/dto/index.ts` - 新しいDTOのexport追加
3. `/src/projects/projects.service.ts` - パスワード関連メソッド追加
4. `/src/projects/projects.controller.ts` - パスワード関連エンドポイント追加
5. `/src/auth/auth.middleware.ts` - プロジェクト共有パスワード認証機能追加

## 実装された機能

### プロジェクトサービス (`projects.service.ts`)
- `setSharedPassword()` - プロジェクト共有パスワード設定
- `authenticateSharedPassword()` - プロジェクト共有パスワード認証
- bcryptを使用したパスワードハッシュ化（saltRounds: 10）

### プロジェクトコントローラー (`projects.controller.ts`)
- `POST /projects/:id/set-password` - プロジェクト共有パスワード設定
- `POST /projects/auth-password` - プロジェクト共有パスワード認証

### 認証ミドルウェア (`auth.middleware.ts`)
- プロジェクト共有パスワード認証サポート
- カスタムヘッダー対応 (`X-Project-Id`, `X-Project-Password-Auth`)
- 権限レベル管理 (viewer/editor)
- TypeScript型定義強化

### DTO (`project-password-auth.dto.ts`)
- `ProjectPasswordAuthDto` - 認証用
- `SetProjectPasswordDto` - パスワード設定用

## ロールバック手順

### 1. 追加ファイルの削除
```bash
rm src/projects/dto/project-password-auth.dto.ts
rm test-project-password.js
```

### 2. 変更ファイルの復元

#### package.json の復元
```bash
npm uninstall bcrypt @types/bcrypt node-fetch
```

#### src/projects/dto/index.ts の復元
```typescript
export { CreateProjectDto } from './create-project.dto';
export { UpdateProjectDto } from './update-project.dto';
export { ProjectResponseDto } from './project-response.dto';
```

#### src/projects/projects.service.ts の復元
- import文から `SetProjectPasswordDto` と `bcrypt` を削除
- `saltRounds` プロパティを削除
- `setSharedPassword()` メソッドを削除
- `authenticateSharedPassword()` メソッドを削除

#### src/projects/projects.controller.ts の復元
- import文から `ProjectPasswordAuthDto`, `SetProjectPasswordDto` を削除
- `setSharedPassword()` メソッドを削除
- `authenticatePassword()` メソッドを削除

#### src/auth/auth.middleware.ts の復元
- `AuthUser` interfaceを元の形に戻す
- `declare global` セクションを削除
- `handleProjectPasswordAuth()` メソッドを削除
- `use()` メソッド内のプロジェクト認証ロジックを削除
- Basic/JWT認証のpermissionプロパティを削除

### 3. 検証
```bash
npm run build
npm run start:dev
```

## リスク評価

### 低リスク
- 既存機能への影響なし（全て追加機能）
- 既存のAPIエンドポイントは変更なし
- データベースマイグレーションなし

### 中リスク
- TypeScript型定義の変更（Express.Request拡張）
- 認証ミドルウェアの変更（既存の動作は維持）

### 高リスク
- なし

## テスト対象

### 機能テスト
1. プロジェクト作成 (`POST /projects`)
2. プロジェクト共有パスワード設定 (`POST /projects/:id/set-password`)
3. プロジェクト共有パスワード認証 (`POST /projects/auth-password`)
   - 成功ケース（正しいパスワード → editor権限）
   - 失敗ケース（間違いパスワード → viewer権限）

### 回帰テスト
1. 既存のプロジェクトCRUD操作
2. 既存の認証ミドルウェア（Basic/JWT/none）
3. ヘルスチェック (`GET /health`)

## 設定

### 環境変数
- 新しい環境変数は不要
- 既存の認証設定 (`AUTH_TYPE`, `BASIC_AUTH_*`, `JWT_*`) は継続使用

### データベース
- `Project.shared_password_hash` フィールド活用（既存）
- 新しいテーブルやマイグレーションなし

## パフォーマンス考慮

### bcryptハッシュ化
- saltRounds: 10（標準的な設定）
- 非同期処理対応
- パスワード設定時のみ実行（頻度低）

### 認証ミドルウェア
- プロジェクト認証は任意（ヘッダー有無で判定）
- 既存認証パフォーマンスへの影響なし