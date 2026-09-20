---
title: このテンプレートは何か
description: テンプレートの全体像、設計思想、構成、および使い始める手順
---

## 概要

Cloudflare のインフラ上で本番運用できる会員制サービスを構築するための、TypeScript によるフルスタックテンプレートです。

AI エージェントと人間が協調して高速に開発・運用サイクルを回すことを前提に設計されており、インフラの宣言、型安全な境界、機械的な品質ゲート、および実測可能な観測性が単一のモノレポに統合されています。

入っている会員機能（認証、プロフィール、AI インタビュー、掲示板、メッセージ等）は見本実装であり、そのまま本番水準の品質を満たす土台として機能します。

## 設計思想

- **AI ネイティブな自律開発**: AI エージェントが自律的にコードを読み、ブラウザを操作して動作確認を行い、トレースや実ログを検証できる構造を持ちます。
- **機械的な制約と品質検証**: 口約束のコーディング規約を排し、型システム・lint・自動テスト・タスクランナーにより、不変条件の破綻を即座に検出します。
- **IaC による外部状態の宣言**: 管理画面の手作業を排除し、Cloudflare の全リソースを Alchemy コードとして宣言・同期します。
- **単一の語彙と責務分離**: ドメインの概念と ER 図、画面仕様、ガイドラインを文書で定義し、実装と意図の乖離を防ぎます。

## リポジトリの構成

モノレポは責務と届く相手に応じて次の 4 領域に整理されています。

- `apps/`: デプロイされて利用者の要求を受ける実行対象
  - `service-member`: 会員向け Web アプリケーション
  - `service-admin`: 運用担当者向け管理アプリケーション
  - `internal-dashboard`: 社内向けドキュメントおよび MCP 配布
- `infra/`: 外部サービス（Cloudflare 等）に状態を残す宣言（Alchemy）
- `libs/`: 複数ワークスペースで共有される型・接続・ロジック（`config`, `db`, `auth`, `runtime`, `observability`, `ui` 等）
- `tools/`: 開発支援・検査・手元ツール（`commander`, `quality` 等）

各アプリの具体的な役割とアクセス境界は [アプリの役割](/getting-started/applications) を参照してください。

## 主な技術スタック

| 領域 | 採用技術 |
| --- | --- |
| ランタイム / 実行基盤 | Cloudflare Workers, D1, Durable Objects, Workflows |
| IaC | Alchemy v2 |
| 言語 / ビルド / モノレポ | TypeScript, Vite+ (Vite, Oxlint, Vitest), pnpm workspaces |
| アプリケーションフレームワーク | TanStack Start (React 19, Tailwind CSS 4), Elysia |
| ロジック / スキーマ / 認証 | Effect v4 (Schema, Layer), Better Auth, Drizzle ORM |
| 観測性 | OpenTelemetry (OTLP), Workers Observability |

## 使い始める手順

1. **サービス定義の変更**:
   - サービス名称を `apps/service-member/src/shared/config/service.ts` で変更します。
   - LP や見本コンテンツを自身のドメインに合わせて差し替えます。
2. **データモデルの定義**:
   - `content/docs/data-model/` の ER 図と [用語集](/glossary) を更新し、自身のサービスに必要な境界を定義します。
   - `libs/db` のスキーマを更新し、マイグレーションを作成します。
3. **デプロイ設定**:
   - `libs/config/src/deployment-keys.ts` で環境変数キーを確認し、Cloudflare のデプロイ先環境を設定します。
   - 一般公開時は `libs/runtime/src/worker.ts` の `x-robots-tag` 設定を見直します。
