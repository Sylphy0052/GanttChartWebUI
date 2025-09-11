# Third-Party Licenses

このドキュメントは、GanttChart WebUIプロジェクトで使用されているサードパーティライブラリとそのライセンス情報をまとめたものです。

## 概要

GanttChart WebUIは、多くの優れたオープンソースライブラリの上に構築されています。これらのライブラリの開発者とコミュニティに深く感謝いたします。

## ライセンス順序

1. [MIT License](#mit-license)
2. [Apache License 2.0](#apache-license-20)
3. [BSD Licenses](#bsd-licenses)
4. [ISC License](#isc-license)
5. [PostgreSQL License](#postgresql-license)

---

## MIT License

### Backend Dependencies

#### Core Framework & Runtime

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [@nestjs/common](https://github.com/nestjs/nest) | ^10.0.0 | MIT | NestJS 共通モジュール |
| [@nestjs/core](https://github.com/nestjs/nest) | ^10.0.0 | MIT | NestJS コアモジュール |
| [@nestjs/platform-express](https://github.com/nestjs/nest) | ^10.0.0 | MIT | NestJS Express プラットフォーム |
| [@nestjs/platform-socket.io](https://github.com/nestjs/nest) | ^10.4.20 | MIT | NestJS Socket.IO プラットフォーム |
| [@nestjs/websockets](https://github.com/nestjs/nest) | ^10.4.20 | MIT | NestJS WebSocket サポート |
| [@nestjs/mapped-types](https://github.com/nestjs/nest) | ^2.1.0 | MIT | NestJS 型マッピング |
| [@nestjs/swagger](https://github.com/nestjs/nest) | ^7.4.0 | MIT | NestJS OpenAPI/Swagger 統合 |

#### Authentication & Security

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | ^6.0.0 | MIT | パスワードハッシュ化ライブラリ |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | ^8.1.0 | MIT | Express レート制限ミドルウェア |
| [helmet](https://github.com/helmetjs/helmet) | ^8.1.0 | MIT | Express セキュリティミドルウェア |

#### Validation & Transformation

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [class-transformer](https://github.com/typestack/class-transformer) | ^0.5.1 | MIT | オブジェクト変換ライブラリ |
| [class-validator](https://github.com/typestack/class-validator) | ^0.14.2 | MIT | バリデーションライブラリ |

#### Utilities

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [archiver](https://github.com/archiverjs/node-archiver) | ^7.0.1 | MIT | アーカイブ作成ライブラリ |
| [fs-extra](https://github.com/jprichardson/node-fs-extra) | ^11.3.1 | MIT | ファイルシステム拡張 |
| [multer](https://github.com/expressjs/multer) | ^1.4.5-lts.1 | MIT | ファイルアップロードミドルウェア |
| [sharp](https://github.com/lovell/sharp) | ^0.32.6 | Apache-2.0 | 高性能画像処理 |
| [reflect-metadata](https://github.com/rbuckton/reflect-metadata) | ^0.1.13 | Apache-2.0 | メタデータリフレクション |

#### Real-time Communication

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [socket.io](https://github.com/socketio/socket.io) | ^4.8.1 | MIT | WebSocket ライブラリ (サーバー) |
| [socket.io-client](https://github.com/socketio/socket.io-client) | ^4.8.1 / ^4.7.4 | MIT | WebSocket ライブラリ (クライアント) |

#### HTTP & Data Processing

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [node-fetch](https://github.com/node-fetch/node-fetch) | ^3.3.2 | MIT | Node.js用fetch実装 |
| [form-data](https://github.com/form-data/form-data) | ^4.0.4 | MIT | フォームデータ処理 |
| [rxjs](https://github.com/ReactiveX/rxjs) | ^7.8.1 | Apache-2.0 | リアクティブプログラミング |

### Frontend Dependencies

#### Core Framework

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [next](https://github.com/vercel/next.js) | ^15.0.3 | MIT | React フレームワーク |
| [react](https://github.com/facebook/react) | ^19.0.0 | MIT | UI ライブラリ |
| [react-dom](https://github.com/facebook/react) | ^19.0.0 | MIT | React DOM レンダラー |

#### UI & Styling

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | ^4.0.0 | MIT | ユーティリティファースト CSS フレームワーク |
| [tailwind-merge](https://github.com/dcastil/tailwind-merge) | ^2.2.0 | MIT | Tailwind CSS クラス結合 |
| [@heroicons/react](https://github.com/tailwindlabs/heroicons) | ^2.0.18 | MIT | React 用アイコンライブラリ |
| [lucide-react](https://github.com/lucide-icons/lucide) | ^0.294.0 | ISC | React 用アイコンライブラリ |
| [framer-motion](https://github.com/framer/motion) | ^10.16.16 | MIT | React アニメーションライブラリ |

#### Drag & Drop

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [@dnd-kit/core](https://github.com/clauderic/dnd-kit) | ^6.1.0 | MIT | ドラッグ&ドロップ コア |
| [@dnd-kit/sortable](https://github.com/clauderic/dnd-kit) | ^8.0.0 | MIT | ソート可能リスト |
| [@dnd-kit/utilities](https://github.com/clauderic/dnd-kit) | ^3.2.2 | MIT | ユーティリティ関数 |

#### Data Grid & Charts

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [ag-grid-community](https://github.com/ag-grid/ag-grid) | ^31.1.1 | MIT | データグリッド (コミュニティ版) |
| [ag-grid-react](https://github.com/ag-grid/ag-grid) | ^31.1.1 | MIT | React AG-Grid ラッパー |
| [recharts](https://github.com/recharts/recharts) | ^2.8.0 | MIT | React チャートライブラリ |

#### Content & Communication

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [react-markdown](https://github.com/remarkjs/react-markdown) | ^9.0.1 | MIT | Markdown レンダラー |

#### Date & Time

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [date-fns](https://github.com/date-fns/date-fns) | ^2.30.0 | MIT | 日付ユーティリティライブラリ |
| [date-fns-tz](https://github.com/marnusw/date-fns-tz) | ^2.0.0 | MIT | タイムゾーン対応日付ライブラリ |

#### Fonts

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [@next/font](https://github.com/vercel/next.js) | ^14.0.3 | MIT | Next.js フォント最適化 |

### Development Dependencies

#### Build Tools & Compilers

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [typescript](https://github.com/microsoft/TypeScript) | ^5.9.2 / ^5 | Apache-2.0 | TypeScript コンパイラ |
| [@nestjs/cli](https://github.com/nestjs/nest) | ^10.4.9 | MIT | NestJS CLI |
| [@nestjs/schematics](https://github.com/nestjs/nest) | ^10.0.0 | MIT | NestJS スキーマティクス |

#### Testing Frameworks

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [jest](https://github.com/facebook/jest) | ^29.5.0 / ^29.5.14 | MIT | JavaScript テストフレームワーク |
| [@nestjs/testing](https://github.com/nestjs/nest) | ^10.0.0 | MIT | NestJS テストユーティリティ |
| [supertest](https://github.com/visionmedia/supertest) | ^6.3.3 | MIT | HTTP テストライブラリ |
| [ts-jest](https://github.com/kulshekhar/ts-jest) | ^29.4.1 | MIT | Jest TypeScript プリプロセッサ |
| [cypress](https://github.com/cypress-io/cypress) | ^15.1.0 | MIT | E2E テストフレームワーク |

#### Code Quality Tools

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [eslint](https://github.com/eslint/eslint) | ^8.42.0 / ^8 | MIT | JavaScript/TypeScript リンター |
| [prettier](https://github.com/prettier/prettier) | ^3.0.0 | MIT | コードフォーマッター |
| [@typescript-eslint/eslint-plugin](https://github.com/typescript-eslint/typescript-eslint) | ^6.0.0 | MIT | TypeScript ESLint プラグイン |
| [@typescript-eslint/parser](https://github.com/typescript-eslint/typescript-eslint) | ^6.0.0 | BSD-2-Clause | TypeScript ESLint パーサー |
| [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) | ^9.0.0 | MIT | Prettier ESLint 設定 |
| [eslint-plugin-prettier](https://github.com/prettier/eslint-plugin-prettier) | ^5.0.0 | MIT | Prettier ESLint プラグイン |
| [eslint-config-next](https://github.com/vercel/next.js) | 15.0.3 | MIT | Next.js ESLint 設定 |

#### Build & Development Tools

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [ts-loader](https://github.com/TypeStrong/ts-loader) | ^9.4.3 | MIT | TypeScript Webpack ローダー |
| [ts-node](https://github.com/TypeStrong/ts-node) | ^10.9.1 | MIT | TypeScript Node.js 実行環境 |
| [tsconfig-paths](https://github.com/dividab/tsconfig-paths) | ^4.2.0 | MIT | TypeScript パス解決 |
| [source-map-support](https://github.com/evanw/node-source-map-support) | ^0.5.21 | MIT | Node.js ソースマップサポート |
| [autoprefixer](https://github.com/postcss/autoprefixer) | ^10.0.1 | MIT | CSS ベンダープレフィックス自動付与 |
| [postcss](https://github.com/postcss/postcss) | ^8 | MIT | CSS 変換ツール |

#### Type Definitions

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^20.3.1 / ^20 | MIT | Node.js 型定義 |
| [@types/react](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^18 | MIT | React 型定義 |
| [@types/react-dom](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^18 | MIT | React DOM 型定義 |
| [@types/bcrypt](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^6.0.0 | MIT | bcrypt 型定義 |
| [@types/express](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^4.17.17 | MIT | Express 型定義 |
| [@types/jest](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^29.5.14 | MIT | Jest 型定義 |
| [@types/multer](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^1.4.13 | MIT | Multer 型定義 |
| [@types/supertest](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^2.0.12 | MIT | Supertest 型定義 |
| [@types/archiver](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^6.0.3 | MIT | Archiver 型定義 |
| [@types/fs-extra](https://github.com/DefinitelyTyped/DefinitelyTyped) | ^11.0.4 | MIT | fs-extra 型定義 |

---

## Apache License 2.0

### Libraries

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [@prisma/client](https://github.com/prisma/prisma) | ^5.6.0 | Apache-2.0 | Prisma データベースクライアント |
| [prisma](https://github.com/prisma/prisma) | ^5.6.0 | Apache-2.0 | Prisma ORM ツールキット |
| [typescript](https://github.com/microsoft/TypeScript) | ^5.9.2 / ^5 | Apache-2.0 | TypeScript コンパイラ |
| [sharp](https://github.com/lovell/sharp) | ^0.32.6 | Apache-2.0 | 高性能画像処理ライブラリ |
| [reflect-metadata](https://github.com/rbuckton/reflect-metadata) | ^0.1.13 | Apache-2.0 | メタデータリフレクション |
| [rxjs](https://github.com/ReactiveX/rxjs) | ^7.8.1 | Apache-2.0 | リアクティブプログラミング |

---

## BSD Licenses

### BSD-2-Clause

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [@typescript-eslint/parser](https://github.com/typescript-eslint/typescript-eslint) | ^6.0.0 | BSD-2-Clause | TypeScript ESLint パーサー |

---

## ISC License

### Libraries

| Library | Version | License | Description |
|---------|---------|---------|-------------|
| [lucide-react](https://github.com/lucide-icons/lucide) | ^0.294.0 | ISC | React 用アイコンライブラリ |

---

## PostgreSQL License

### Database

| Software | Version | License | Description |
|----------|---------|---------|-------------|
| [PostgreSQL](https://www.postgresql.org/) | 15+ | PostgreSQL License | オープンソースリレーショナルデータベース |

---

## ライセンス全文

### MIT License

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache License 2.0

Apache License 2.0の全文は以下をご参照ください：
https://www.apache.org/licenses/LICENSE-2.0

### BSD-2-Clause License

```
BSD 2-Clause License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### ISC License

```
ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### PostgreSQL License

PostgreSQL Licenseの全文は以下をご参照ください：
https://www.postgresql.org/about/licence/

---

## 著作権・商標について

### プロジェクト著作権

**GanttChart WebUI** - Copyright (c) 2024-2025 GanttChart WebUI Project Contributors

### 商標

以下は各権利者の商標または登録商標です：

- **Node.js**: Node.js Foundation の商標
- **TypeScript**: Microsoft Corporation の商標
- **React**: Meta Platforms, Inc. の商標
- **Docker**: Docker, Inc. の商標
- **PostgreSQL**: PostgreSQL Global Development Group の商標
- **Prisma**: Prisma Data, Inc. の商標
- **NestJS**: Kamil Myśliwiec の商標
- **Next.js**: Vercel Inc. の商標
- **Tailwind CSS**: Tailwind Labs Inc. の商標

### 免責事項

1. **ソフトウェアの提供**: 本ソフトウェアは「現状有姿」で提供され、明示的または暗示的な保証はありません。

2. **責任制限**: いかなる場合においても、開発者は本ソフトウェアの使用に起因するいかなる損害についても責任を負いません。

3. **ライセンス遵守**: 各サードパーティライブラリのライセンス条項を遵守してください。

4. **更新責任**: 依存関係の更新時は、ライセンス情報の変更を確認し、本文書を更新してください。

5. **商用利用**: 本ソフトウェアの商用利用は認められていますが、各依存ライブラリのライセンス条項を確認してください。

6. **法的助言**: 特定の法的問題については、適切な法的専門家にご相談ください。

---

## コンプライアンス確認

### ライセンス互換性

- **MIT License**: 商用利用・再配布・修正可能、著作権表示要求
- **Apache License 2.0**: 商用利用・再配布・修正可能、著作権・ライセンス表示要求
- **BSD Licenses**: 商用利用・再配布・修正可能、著作権表示要求
- **ISC License**: 商用利用・再配布・修正可能、著作権表示要求
- **PostgreSQL License**: MIT Licenseに類似、制限なく使用可能

### 推奨事項

1. **定期確認**: 依存関係更新時のライセンス変更確認
2. **法的レビュー**: 商用利用前の法的専門家による確認
3. **文書更新**: 新規依存関係追加時の本文書更新
4. **社内ポリシー**: オープンソースライセンス利用ポリシーの策定

### オープンソースコンプライアンス

1. **ライセンス表示**: 本LICENSEファイルとTHIRD_PARTY_LICENSES.mdの保持
2. **著作権継承**: 各ライブラリの著作権表示の保持
3. **変更の明示**: 修正時の適切な変更ログ・バージョン管理
4. **再配布時の義務**: ライセンス文書の同梱

---

## 企業・商用利用について

### 利用許可

GanttChart WebUIは、MIT Licenseの下で以下の利用が許可されています：

- **商用利用**: 営利目的での使用・販売・サービス化
- **再配布**: ソースコード・バイナリの再配布
- **修正**: 機能追加・変更・カスタマイズ
- **プライベート利用**: 社内システム・内部ツールとしての利用

### 企業利用時の推奨事項

1. **法務確認**: 社内コンプライアンス部門での事前確認
2. **ライセンス管理**: 依存関係ライセンスの社内データベース管理
3. **セキュリティ監査**: 定期的な脆弱性スキャン・セキュリティ監査
4. **サポート体制**: 自社でのメンテナンス・サポート体制構築

---

## 更新履歴

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-15 | 1.1.0 | express-rate-limit, helmet 追加・著作権年更新・企業利用ガイド追加 |
| 2025-01-15 | 1.0.0 | 初版作成 - プロジェクト開始時の依存関係を記録 |

---

**最終更新**: 2025年1月15日  
**メンテナー**: GanttChart WebUI Project Team  
**ライセンス**: MIT License

このドキュメントに関する質問や更新提案がございましたら、プロジェクトのIssueトラッカーにてお知らせください。