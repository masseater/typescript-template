---
title: 技術スタック
description: 主要技術の働きと、公式ドキュメント・サンプル・解説記事への参照
---

この節が持つのは、各技術の働きと、公式ドキュメント・サンプル・記事へのリンクである。版は `pnpm-workspace.yaml` の catalog が持つので、ここには書かない。コンポーネントをどこに置くかは [フロントエンド](/guidelines/frontend)、資源をどう宣言するかは [インフラ](/guidelines/infrastructure) が持つ。どの領域に何を置くかは [このテンプレートは何か](/getting-started/what-is-this) の表にある。ブラウザから SLI までの層は [Observability](/observability) が持つ。各ページの「採ると」は、そのページの例が採る前と採ったあとでどう変わるかを持つ。

## ページ

- [TanStack Start](/tech-stack/tanstack-start) — ファイルのルート、loader、server function
- [Elysia](/tech-stack/elysia) — `/api` の HTTP と Eden Treaty
- [TypeScript](/tech-stack/typescript) — 添字、optional property、`import type`
- [Vite+](/tech-stack/vite-plus) — `vp`
- [Effect](/tech-stack/effect) — `Effect.fn`、Schema、Atom、`effect-tsgo`
- [OpenTelemetry](/tech-stack/opentelemetry) — span、`traceparent`、OTLP、自動計装
- [Drizzle](/tech-stack/drizzle) — `sqliteTable`、マイグレーション、D1 の `batch`
- [TanStack Query](/tech-stack/tanstack-query) — `queryOptions` と `useQuery`
- [Base UI と shadcn](/tech-stack/ui) — 挙動と、リポジトリ内のコンポーネント
- [Feature-Sliced Design](/tech-stack/feature-sliced-design) — レイヤー、スライス、`index.ts`
- [Alchemy](/tech-stack/alchemy) — 資源の宣言と `alchemy plan`
- [Cloudflare](/tech-stack/cloudflare) — Workers、binding、D1、Durable Objects
- [OpenFeature](/tech-stack/openfeature) — 機能フラグの評価 API。本テンプレートは Cloudflare Flagship を provider に使う
